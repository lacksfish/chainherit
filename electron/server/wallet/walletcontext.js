import * as bitcoin from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { BIP32Factory } from 'bip32'
import { ECPairFactory } from 'ecpair'
import { parseDerivationPath } from '../utils/crypto'

const bip32 = BIP32Factory(ecc)
const ECPair = ECPairFactory(ecc)


let getPath = (purpose, account, change, index, network) => {
    return purpose + "'/" + (network == bitcoin.networks.testnet ? '1' : '0') + "'/" + account + "'/" + change + "/" + index
}

let explodePath = (derivationPath) => {
    return derivationPath.replace(/\D+/g, ' ').trim().split(' ').map(e => parseInt(e))
}


class WalletContext {
    xpub
    network
    electrum
    derivations
    xpubNode

    constructor(xpub, electrum, network, derivations) {
        if (!derivations) {
            this.derivations = []
        } else {
            this.derivations = derivations
        }

        this.electrum = electrum
        this.network = network
        this.xpub = xpub
        this.xpubNode = bip32.fromBase58(xpub, network)
    }

    getDerivationsWithUTXOs() {
        return this.derivations.filter(deri => deri.utxos.length > 0)
    }

    addAddress(address, derivationPath, scriptObj, pubKeyHex, addressData = null) {
        let self = this

        if (addressData) {
            addressData = Promise.resolve(addressData)
        } else {
            addressData = self.fetchAddressInformation(address)
        }

        return addressData.then((addressData) => {
            let derivation = {
                address: address,
                // scriptObj: scriptObj,
                derivationPath: derivationPath,
                utxos: addressData.utxos,
                used: addressData.used,
                pubKeyHex: pubKeyHex,
                txCount: addressData.txCount
            }

            self.derivations.push(derivation)
            return addressData.used
        })
    }

    fetchAddressInformation = async (address) => {
        // Check if address has history
        let result = await this.electrum.addressGetHistory(address)

        if (result.length > 0) {
            let txCount = result.length
            // check if address has utxos
            result = await this.electrum.addressListUnspent(address)

            if (result.length == 0) {
                return {
                    utxos: [],
                    used: true,
                    txCount: txCount
                }
            } else {
                let utxos = result.map(async (utxo) => {
                    let rawTx = await this.electrum.transactionGet(utxo.tx_hash)
                    let tx = bitcoin.Transaction.fromHex(rawTx)
                    return {
                        raw: rawTx,
                        tx_hash: utxo.tx_hash,
                        block_height: utxo.height,
                        value: utxo.value,
                        tx_output_n: utxo.tx_pos,
                        scriptPubKey: tx.outs[utxo.tx_pos].script.toString('hex')
                    }
                })

                return {
                    utxos: await Promise.all(utxos),
                    used: true,
                    txCount: txCount
                }
            }
        } else {
            return {
                utxos: [],
                used: false,
                txCount: 0
            }
        }
    }

    generateScript(pubKeyHex, derivationPath) {
        let purpose = explodePath(derivationPath)[0]

        let pubKey = ECPair.fromPublicKey(Buffer.from(pubKeyHex, "hex"))
        let script = null
        switch (purpose) {
            case 44:
                script = bitcoin.payments.p2pkh({
                    pubkey: pubKey.publicKey,
                    network: this.network
                })
                break
            case 49:
                let p2wpkh = bitcoin.payments.p2wpkh({
                    pubkey: pubKey.publicKey,
                    network: this.network
                })
                let p2pkh = bitcoin.payments.p2pkh({
                    pubkey: pubKey.publicKey,
                    network: this.network
                })
                script = bitcoin.payments.p2sh({
                    redeem: p2wpkh,
                    network: this.network
                })
                break
            case 84:
                script = bitcoin.payments.p2wpkh({
                    pubkey: pubKey.publicKey,
                    network: this.network
                })
                break
            default:
                throw new Error("Unsupported purpose in derivation!")
        }
        return script
    }

    /**
      initialize the (u)txo set
    */
    initialize = (options) => {
        let self = this

        if (!options) options = {}

        let derivationSet = options.derivationSet ? options.derivationSet : []
        let purposes = options.purposes ? options.purposes : [44, 49, 84]
        let gapCount = options.gapCount ? options.gapCount : 20
        let derivationPaths = options.derivationPaths ? options.derivationPaths : []

        const walletContextUpdateLoop = (purpose, account, change, index) => {
            let pubKey = this.xpubNode.derive(change).derive(index).publicKey
            let pubKeyHex = pubKey.toString('hex')
            let path = getPath(purpose, account, change, index, this.network)

            let script = this.generateScript(pubKeyHex, path)
            return self.addAddress(script.address, path, script, pubKeyHex)
        }

        const derivationLoop = async (purpose, account, change, index, currentGap, batchSize = 20) => {
            let promises = []
            for (let i = 0; i < batchSize; i++) {
                promises.push(walletContextUpdateLoop(purpose, account, change, index + i))
            }

            const results = await Promise.all(promises)

            for (let i = 0; i < results.length; i++) {
                let proceed = results[i]
                // if empty wallet (first address never used)
                if (!proceed && index == 0) {
                    self.derivations.pop()
                    return true
                }
                if (!proceed) currentGap += batchSize // Increment gap if address is unused
                if (currentGap > 0 && proceed) currentGap = 0 // Reset intermediate gaps
                if ((proceed || currentGap + batchSize < gapCount)) {
                    // Itterate over all addresses with balances
                    return derivationLoop(purpose, account, change, index + batchSize, currentGap)
                } else if (change == 0/* && index != 0*/) {
                    // Check change index
                    return derivationLoop(purpose, account, 1, 0, 0)
                } else {
                    return true
                }
            }
        }

        // if derivation paths have been provided, initialize only those
        if (derivationPaths && derivationPaths.length > 0) {
            return Promise.all(derivationPaths.map(async (derivationPath) => {
                let deriPath = parseDerivationPath(derivationPath)
                await walletContextUpdateLoop(deriPath.purpose, deriPath.account, deriPath.change, deriPath.index)
            }))
        }

        // If derivation set has been provided, initialize it
        if (derivationSet && derivationSet.length > 0) {
            return Promise.all(derivationSet.map((derivation) => {
                let script = this.generateScript(derivation.pubKeyHex, derivation.derivationPath)
                let addressData = {
                    'utxos': derivation.utxos,
                    'used': derivation.used
                }
                return self.addAddress(script.address, derivation.derivationPath, script, derivation.pubKeyHex, addressData)
            }))
        } else {
            // If no derivation set has been provided, initialize from scratch
            // 44 = P2PKH
            // 49 = P2SH-P2WPKH
            // 84 = P2WPKH
            return purposes.reduce((p, purpose) =>
                p.then(_ => derivationLoop(purpose, 0, 0, 0, 0)),
                Promise.resolve()
            )
        }
    }

    getTotalBalance = () => {
        let utxobalances = [].concat.apply([], this.derivations.map(deri => deri.utxos.map(utxo => utxo.value)))
        return utxobalances.reduce((balance, acc) => acc + balance, 0)
    }
}

export default WalletContext