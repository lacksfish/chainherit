import * as bitcoin from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { BIP32Factory } from 'bip32'
import { ECPairFactory } from 'ecpair'
import WalletContext from '../wallet/walletcontext'
import ElectrumConnection from '../network/electrum'

import { convertXpubKey, addressToScriptHash } from './../utils/crypto'
import { getNetwork, isTestnet } from './../network/env'

const bip32 = BIP32Factory(ecc)
const ECPair = ECPairFactory(ecc)

function generateAddresses(rootPubKey, derivationPaths = null, electrum = null) {
    const NETWORK = getNetwork()
    const TESTNET = isTestnet()
    const xpub = convertXpubKey(rootPubKey, TESTNET)

    if (!electrum) {
        electrum = new ElectrumConnection()
    }

    // get first 4 letters of rootPubKey
    let purposes = null
    const rootPubKeyPrefix = rootPubKey.substring(0, 4)
    switch (rootPubKeyPrefix) {
        case 'xpub':
            purposes = [44, 49, 84]
            break
        case 'ypub':
            purposes = [49, 84]
            break
        case 'zpub':
            purposes = [84]
            break
        default:
            purposes = [44, 49, 84]
    }

    let wc = null
    return electrum.connect()
        .then(() => {
            wc = new WalletContext(xpub, electrum, NETWORK, null)
            return wc.initialize({
                purposes: purposes,
                derivationPaths: derivationPaths
            })
        }).then(() => {
            return wc.derivations.map((derivation) => {
                let confirmedBalance = 0
                let unconfirmedBalance = 0
                derivation.utxos.map((utxo) => {
                    if (utxo.block_height <= 0) {
                        unconfirmedBalance += utxo.value
                    } else {
                        confirmedBalance += utxo.value
                    }
                })
                return {
                    address: derivation.address,
                    derivationPath: derivation.derivationPath,
                    confirmedBalance: confirmedBalance,
                    unconfirmedBalance: unconfirmedBalance,
                    totalBalance: confirmedBalance + unconfirmedBalance,
                    scriptHash: addressToScriptHash(derivation.address, NETWORK),
                    pubkey: derivation.pubKeyHex,
                    txCount: derivation.txCount,
                    utxos: derivation.utxos
                }
            })
        })
}

function generateUnsignedTransaction(rootPubkey, recipients, validityDate, txFee, returnWalletContext = false) {
    const NETWORK = getNetwork()
    const TESTNET = isTestnet()
    const xpub = convertXpubKey(rootPubkey, TESTNET)
    let electrum = new ElectrumConnection()

    let unconfirmedInputs = false

    // TODO we have the UTXOs in the database, we could use them instead of fetching them again
    // we will once more trust has been established with the addressUpdater/addressListener
    // for now, we will fetch the UTXOs again as this is up-to-date and reliable
    let wc = null
    return electrum.connect()
        .then(() => {
            console.log('Constructing wallet state (updating utxo balances)')
            wc = new WalletContext(xpub, electrum, NETWORK, null)
            return wc.initialize()
        }).then(() => {
            console.log('Wallet state synced')
            const psbt = new bitcoin.Psbt({ network: NETWORK })

            let totalValueSum = 0
            let segwitUtxoCount = 0
            let nonSegwitUtxoCount = 0

            wc.derivations.forEach((derivation) => {
                derivation.utxos.map((utxo) => {
                    if (utxo.scriptPubKey.startsWith("0014") || utxo.scriptPubKey.startsWith("0020")) {
                        segwitUtxoCount += 1
                    } else {
                        nonSegwitUtxoCount += 1
                    }

                    if (utxo.block_height <= 0) {
                        unconfirmedInputs = true
                    }

                    psbt.addInput({
                        hash: utxo.tx_hash,
                        index: utxo.tx_output_n,
                        nonWitnessUtxo: Buffer.from(utxo.raw, "hex"),
                        sequence: 0x0
                    })
                    totalValueSum += utxo.value
                })
            })

            // Estimate transaction size
            const nonSegwitInputsSize = nonSegwitUtxoCount * 180 // 180 bytes per non-SegWit input
            const segwitInputsSize = segwitUtxoCount * 68.5 // 68.5 vbytes per SegWit input
            const inputsSize = nonSegwitInputsSize + segwitInputsSize
            const outputsSize = recipients.length * 34 // 34 bytes per output
            const transactionSize = inputsSize + outputsSize + 10 // 10 bytes for the transaction header
            const estimateTransactionFee = transactionSize * txFee

            let totalPercentage = recipients.reduce((sum, recipient) => sum + parseFloat(recipient.percentage), 0)

            recipients.map((recipient) => {
                let recipientPercentage = parseFloat(recipient.percentage) / totalPercentage
                let recipientFee = estimateTransactionFee * recipientPercentage
                psbt.addOutput({
                    script: bitcoin.address.toOutputScript(recipient.address, NETWORK),
                    value: Math.floor((totalValueSum * parseFloat(recipient.percentage) / 100) - recipientFee)
                })
            })

            validityDate = Math.floor(validityDate.getTime() / 1000)
            psbt.setLocktime(validityDate)

            if (!returnWalletContext) {
                return {
                    unsigned: psbt.toHex(),
                    totalValue: totalValueSum,
                    unconfirmedInputs: unconfirmedInputs
                }
            } else {
                return {
                    unsigned: psbt.toHex(),
                    totalValue: totalValueSum,
                    unconfirmedInputs: unconfirmedInputs,
                    walletContext: wc
                }
            }
        })
}

var compareTxToPSBT = async (tx, psbt) => {
    if (!(tx.version == psbt.version) || !(tx.locktime == psbt.locktime)) {
        return false
    }

    let checkIns = tx.ins.every((txin, idx) => {
        return txin.index == psbt.txInputs[idx].index &&
            txin.hash.toString('hex') == psbt.txInputs[idx].hash.toString('hex') &&
            txin.sequence == psbt.txInputs[idx].sequence
    })

    let checkOuts = tx.outs.every((txout, idx) => {
        return txout.value == psbt.txOutputs[idx].value &&
            txout.script.toString('hex') == psbt.txOutputs[idx].script.toString('hex')
    })

    return checkIns && checkOuts
}


export {
    generateUnsignedTransaction,
    generateAddresses,
    compareTxToPSBT
}