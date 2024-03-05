import * as bitcoin from 'bitcoinjs-lib'
import { sha3_256 } from '@noble/hashes/sha3'
import { bytesToHex } from '@noble/hashes/utils'

import { getPrismaClient } from './../../db/client'
import redish from './../../db/redish'
import { generateUnsignedTransaction, compareTxToPSBT } from '../../wallet/walletutils'
import validate from './../../validation/validation'

import { getNetwork } from './../../network/env'

const getTxInfo = async (event, req) => {
    const prisma = getPrismaClient()
    const NETWORK = getNetwork()

    let wallet = await prisma.Wallet.findFirst({
        where: {
            label: req.walletLabel
        },
        select: {
            id: true,
            rootPubKey: true,
            label: true
        }
    })

    if (!wallet) {
        return {
            status: 422,
            errors: ["Wallet not found"]
        }
    }

    // select transaction for this wallet
    let tx = await prisma.TransactionSigned.findFirst({
        where: {
            walletId: wallet.id,
            active: true
        },
        select: {
            id: true,
            transaction: true,
            locktime: true,
            totalAmount: true,
        }
    })

    tx.totalAmount = parseInt(tx.totalAmount)

    if (!tx) {
        return {
            status: 422,
            errors: ["Transaction not found"]
        }
    }

    // parse transaction
    let parsedTx = bitcoin.Transaction.fromHex(tx.transaction, NETWORK)
    // get byte size of transaction
    let txSize = parsedTx.virtualSize()

    let totalOutputAmount = 0
    let outputs = parsedTx.outs.map(async (out) => {
        //parse bitcoin script to address
        let address = bitcoin.address.fromOutputScript(out.script, NETWORK)
        let recipient = await prisma.recipient.findFirst({
            where: {
                address: address
            },
            select: {
                id: true,
                label: true
            }
        })
        totalOutputAmount += out.value
        return {
            recipient: recipient.label,
            address: address,
            value: out.value,
        }
    })

    // TODO reevaluate this wrt database queries
    outputs = await Promise.all(outputs)

    let feePaid = tx.totalAmount - totalOutputAmount

    return {
        status: 200,
        outputs,
        locktime: tx.locktime,
        totalInputAmount: tx.totalAmount,
        totalOutputAmount: totalOutputAmount,
        txSize: txSize,
        transaction: tx.transaction
    }
}

const generateTX = async (event, req) => {
    const prisma = getPrismaClient()
    const valid = validate.generateTX(req)
    if (!valid) {
        let errors = []
        validate.generateTX.errors.map((error) => {
            if (error.instancePath == '/distLabel') {
                errors.push("Distribution label is invalid")
            }
            if (error.instancePath == '/walletLabel') {
                errors.push("Wallet label is invalid")
            }
            if (error.instancePath == '/validityDate') {
                errors.push("Validity date is invalid")
            }
            if (error.instancePath == '/txFee') {
                errors.push("Transaction fee is invalid")
            }
        })
        return {
            status: 422,
            errors: errors
        }
    }

    // Begin by checking if the wallet and distribution exist and belong to the user
    let wallet = await prisma.Wallet.findFirst({
        where: {
            label: req.walletLabel
        },
        select: {
            rootPubKey: true
        },
    })

    let distribution = await prisma.distribution.findUnique({
        where: {
            label: req.distLabel
        },
        select: {
            label: req.distLabel,
            distShares: {
                select: {
                    recipient: {
                        select: {
                            label: true,
                            address: true
                        }
                    },
                    percentage: true
                }
            }
        },
    })

    if (wallet) {
        let rootPubKey = wallet.rootPubKey
        let unsignedTx = null
        try {
            let distShares = distribution.distShares.map((ds) => {
                ds.recipient.percentage = parseFloat(ds.percentage)
                return ds.recipient
                // TODO validate Date to be in the future VALIDATION
            })
            unsignedTx = await generateUnsignedTransaction(rootPubKey, distShares, new Date(req.validityDate), req.txFee)
        } catch (e) {
            console.log(e)
            try {
                if (e.includes("Expected property \"1\" of type Satoshi")) {
                    return { status: 422 }
                }
            } catch (e) {
                return { status: 404 }
            }
        }

        const redisHash = bytesToHex(sha3_256(rootPubKey))
        let result = await redish.set(redisHash, unsignedTx.unsigned, 'EX', 43200)
        if (result != "OK") {
            return { status: 403 }
        }
        return {
            status: 200,
            unsignedTx: unsignedTx.unsigned,
            totalValue: unsignedTx.totalValue,
            unconfirmedInputs: unsignedTx.unconfirmedInputs
        }

    } else {
        return { status: 404 }
    }
}


const postTX = async (event, req) => {
    const prisma = getPrismaClient()
    const NETWORK = getNetwork()

    // Validation
    const valid = validate.postTX(req)
    if (!valid) {
        let errors = []
        validate.postTX.errors.map((error) => {
            if (error.instancePath == '/distLabel') {
                errors.push("Distribution label is invalid")
            }
            if (error.instancePath == '/walletLabel') {
                errors.push("Wallet label is invalid")
            }
            if (error.instancePath == '/validityDate') {
                errors.push("Validity date is invalid")
            }
            if (error.instancePath == '/unsignedTx') {
                errors.push("Unsigned transaction is invalid")
            }
            if (error.instancePath == '/signedTx') {
                errors.push("Signed transaction is invalid")
            }

        })
        return {
            status: 422,
            errors: errors
        }
    }

    let wallet = await prisma.wallet.findFirst({
        where: {
            label: req.walletLabel
        },
        select: {
            id: true,
            rootPubKey: true
        },
    })

    let distribution = await prisma.distribution.findFirst({
        where: {
            label: req.distLabel
        },
        select: {
            id: true,
            distShares: {
                select: {
                    recipient: {
                        select: {
                            label: true,
                            address: true
                        }
                    },
                    percentage: true
                }
            }
        },
    })
    const redisHash = bytesToHex(sha3_256(wallet.rootPubKey))
    let data = await redish.get(redisHash)
    let psbt
    let txp
    try {
        psbt = bitcoin.Psbt.fromHex(data, { network: NETWORK })
        txp = bitcoin.Transaction.fromHex(req.signedTx)
    } catch (e) {
        return {
            errors: ["Error parsing signed transaction."],
            status: 422
        }
    }
    // TODO: Validate based on tx. So is tx valid when disregarding locktime
    // I've considered a patched version of the 'testmempoolaccept' rpc call, but that needs a full node
    let isValid = compareTxToPSBT(txp, psbt)
    if (isValid) {
        // Calculate total amount in inputs
        let totalAmount = 0
        psbt.data.inputs.forEach((input, idx) => {
            let inputAmount = 0
            if (input.witnessUtxo) {
                const tx = bitcoin.Transaction.fromBuffer(input.witnessUtxo)
                inputAmount = tx.outs[txp.ins[idx].index].value
            } else if (input.nonWitnessUtxo) {
                const tx = bitcoin.Transaction.fromBuffer(input.nonWitnessUtxo)
                inputAmount = tx.outs[txp.ins[idx].index].value
            }
            totalAmount += inputAmount
        })

        try {
            // TODO consider atomic change
            // Get last active transaction
            let query = await prisma.TransactionSigned.findFirst({
                where: {
                    walletId: wallet.id,
                    active: true
                },
                select: {
                    id: true,
                    transaction: true
                }
            })

            if (query) {
                if (query.transaction == req.signedTx) {
                    return { status: 304 }
                }

                let update = await prisma.TransactionSigned.update({
                    where: {
                        id: query.id
                    },
                    data: {
                        active: false
                    }
                })
            }

            // Insert new transaction
            query = await prisma.TransactionSigned.create({
                data: {
                    walletId: wallet.id,
                    distributionId: distribution.id,
                    totalAmount: String(totalAmount),
                    transaction: req.signedTx,
                    locktime: new Date(txp.locktime * 1000),
                    active: true
                }
            })

            if (query) {
                let data = await redish.del(redisHash)
                return { status: 200 }
            }
        } catch (e) {
            return { status: 422 }
        }
    }
    return { status: 422 }
}

export default {
    getTxInfo,
    generateTX,
    postTX
}