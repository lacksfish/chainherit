import { getPrismaClient } from './../../db/client'

// Validation
import validate from './../../validation/validation'
import { generateAddresses } from './../../wallet/walletutils'

const getWallets = async (req, res) => {
    const prisma = getPrismaClient()
    let wallets = await prisma.wallet.findMany({
        select: {
            rootPubKey: true,
            label: true,
            transaction: {
                select: {
                    totalAmount: true,
                    locktime: true,
                    createdAt: true
                },
                where: { active: true }
            },
            addresses: {
                select: {
                    address: true,
                    confirmedBalance: true,
                    unconfirmedBalance: true,
                    pubkey: true,
                    derivationPath: true,
                    scriptHash: true
                }
            }
        },
    })

    // Parse values from String to Int
    wallets = wallets.map((wallet) => {
        wallet.transaction = wallet.transaction.map((tx) => {
            tx.totalAmount = parseInt(tx.totalAmount)
            return tx
        })
        wallet.addresses = wallet.addresses.map((address) => {
            address.unconfirmedBalance = parseInt(address.unconfirmedBalance)
            address.confirmedBalance = parseInt(address.confirmedBalance)
            return address
        })
        return wallet
    })

    return wallets
}

const deleteWallet = async (event, req) => {
    const prisma = getPrismaClient()
    const valid = validate.deleteWallet(req)
    if (!valid) {
        let errors = []
        validate.deleteWallet.errors.map((error) => {
            if (error.instancePath == '/walletLabel') {
                errors.push("Wallet Label is invalid")
            }
        })
        return {
            status: 422,
            errors: errors
        }
    }

    try {
        const result = await prisma.$transaction(async (prisma) => {
            let query = await prisma.wallet.findUnique({
                select: {
                    id: true
                },
                where: {
                    label: req.walletLabel
                }
            })
            let walletId = query.id

            query = await prisma.transactionSigned.deleteMany({
                where: {
                    walletId: walletId
                }
            })

            query = await prisma.UTXO.deleteMany({
                where: {
                    address: {
                        is: {
                            walletId: walletId
                        }
                    }
                }
            })

            query = await prisma.address.deleteMany({
                where: {
                    walletId: walletId
                }
            })

            query = await prisma.wallet.delete({
                where: {
                    label: req.walletLabel,
                }
            })
        })
        return { status: 200 }
    } catch (e) {
        console.error(e)
        return { status: 422 }
    }
}

const addPublicKey = async (event, req) => {
    const prisma = getPrismaClient()
    const valid = validate.addPublicKey(req)
    if (!valid) {
        let errors = []
        let errorCode = 422
        validate.addPublicKey.errors.map((error) => {
            if (error.instancePath == '/publicKey') {
                errors.push("Root Public Key is invalid")
            }
            if (error.instancePath == '/publicKeyLabel') {
                errors.push("Label is invalid")
                errorCode = 409
            }
        })
        return {
            status: errorCode,
            errors: errors
        }
    }

    let wallet = await prisma.wallet.findMany({
        where: {
            OR: [
                {
                    rootPubKey: req.publicKey
                },
                {
                    label: req.publicKeyLabel
                }
            ]
        }
    })

    if (wallet.length == 0) {
        // generate addresses and add them to the database
        let addresses = []
        try {
            addresses = await generateAddresses(req.publicKey)
        } catch (e) {
            console.error(e)
            return {
                status: 422,
                errors: ["Invalid public key"]
            }
        }

        // TODO consider atomic change
        let walletQuery = await prisma.wallet.create({
            data: {
                rootPubKey: req.publicKey,
                label: req.publicKeyLabel
            }
        })

        await Promise.all(addresses.map(async (address) => {

            let addressQuery = await prisma.address.create({
                data: {
                    walletId: walletQuery.id,
                    address: address.address,
                    derivationPath: address.derivationPath,
                    scriptHash: address.scriptHash,
                    pubkey: address.pubkey,
                    unconfirmedBalance: String(address.unconfirmedBalance),
                    confirmedBalance: String(address.confirmedBalance),
                    txCount: address.txCount
                }
            })

            return await Promise.all(address.utxos.map(async (utxo) => {
                return await prisma.UTXO.create({
                    data: {
                        txRaw: String(utxo.raw),
                        txHash: String(utxo.tx_hash),
                        blockHeight: String(utxo.block_height),
                        value: String(utxo.value),
                        txOutputN: String(utxo.tx_output_n),
                        scriptPubKey: String(utxo.scriptPubKey),
                        addressId: addressQuery.id
                    }

                })
            }))

            return
        }))

        return {
            status: 200
        }
    } else {
        return {
            status: 409,
            errors: ["Label or public key already exists"]
        }
    }
}

export default {
    getWallets,
    deleteWallet,
    addPublicKey
}