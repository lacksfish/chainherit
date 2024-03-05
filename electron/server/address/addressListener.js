import { generateAddresses } from '../wallet/walletutils'
import { parseDerivationPath } from '../utils/crypto'
import { getPrismaClient } from './../db/client'
import { compareUtxos, upsertAddress, updateOrInsertUtxos } from './addressUtils'

let walletPendingGapUpdates = {}

class AddressListener {

    electrum = null
    providedElectrum = false
    eventCallback = null
    eventDelayedExecution = null

    constructor(electrum, eventCallback) {
        this.eventCallback = eventCallback
        if (electrum) {
            this.providedElectrum = true
            this.electrum = electrum
        } else {
            throw Error('Electrum connection is required')
        }

        this.electrum.addEventListener('reconnectEvent', () => {
            console.log('electrum reconnect event in AL')
            this.initialize(false)
        })
    }

    async updateAddress(data) {
        const prisma = getPrismaClient()

        // get derivation path from scriptHash
        let addressQuery = await prisma.Address.findUnique({
            where: {
                scriptHash: data[0]
            },
            select: {
                id: true,
                address: true,
                derivationPath: true,
                unconfirmedBalance: true,
                confirmedBalance: true,
                txCount: true,
                wallet: {
                    select: {
                        id: true,
                        rootPubKey: true
                    }
                },
                utxos: {
                    select: {
                        txRaw: true,
                        txHash: true,
                        blockHeight: true,
                        value: true,
                        txOutputN: true,
                        scriptPubKey: true
                    }
                }
            }
        })

        let addressData = await generateAddresses(addressQuery.wallet.rootPubKey, [addressQuery.derivationPath], this.electrum)
        let invalidateTx = false
        console.log("UTXO change: " + JSON.stringify(addressData[0]))

        // If balances are different, update
        if (addressData[0].confirmedBalance != addressQuery.confirmedBalance || addressData[0].unconfirmedBalance != addressQuery.unconfirmedBalance) {
            console.log("Balance change detected, updating...")
            // update balance
            await Promise.all(addressData.map(async (address) => {
                let addressUtxos = addressQuery.utxos
                // Find new utxos
                let newUtxos = address.utxos.filter((utxo) => {
                    return !addressUtxos.some((addressUtxo) => compareUtxos(addressUtxo, utxo))
                })

                // Find spent utxos
                let spentUtxos = addressUtxos.filter((addressUtxo) => {
                    return !address.utxos.some((utxo) => compareUtxos(addressUtxo, utxo))
                })

                // Insert new utxos and delete outdated utxos
                if (newUtxos.length > 0 || spentUtxos.length > 0) {
                    if (spentUtxos.length > 0) {
                        // TODO, alert when new utxo (in newUTXOs) is found. doesnt invalidate prev tx, but is not inherited
                        invalidateTx = true
                    }
                    await updateOrInsertUtxos(newUtxos, spentUtxos, addressQuery.id)
                }

                await upsertAddress(address, addressQuery.wallet.id)
            }))
        }

        let address = addressQuery
        const dP = parseDerivationPath(address.derivationPath)

        if (walletPendingGapUpdates[address.wallet.rootPubKey + dP.change]) {
            clearTimeout(walletPendingGapUpdates[address.wallet.rootPubKey + dP.change])
            delete walletPendingGapUpdates[address.wallet.rootPubKey + dP.change]
        }

        walletPendingGapUpdates[address.wallet.rootPubKey + dP.change] = setTimeout(async () => {
            walletPendingGapUpdates[address.wallet.rootPubKey + dP.change] = null
            this.updateGap(address.wallet.id, address.wallet.rootPubKey, address.derivationPath)
        }, 10000)

        // check if address is associated with any active inheritance transactions
        let activeInheritance = await prisma.Address.findUnique({
            where: {
                scriptHash: data[0]
            },
            select: {
                wallet: {
                    select: {
                        transaction: {
                            select: {
                                id: true,
                                active: true
                            },
                            where: {
                                active: true
                            }
                        }
                    }
                }
            }
        })

        // If transaction is active, the address update will invalidate the inheritance transaction
        if (activeInheritance.wallet.transaction.length > 0 && activeInheritance.wallet.transaction[0].active
            && !(address.txCount == addressData[0].txCount) && invalidateTx) {
            console.log("Inheritance transaction is active but coins have moved, invalidating...")
            await prisma.TransactionSigned.update({
                where: {
                    id: activeInheritance.wallet.transaction[0].id
                },
                data: {
                    active: false
                }
            })
        }
        // Trigger reloadwallet in frontend, debounced
        if (this.eventDelayedExecution) {
            clearTimeout(this.eventDelayedExecution)
            this.eventDelayedExecution = null
        }
        this.eventDelayedExecution = setTimeout(() => {
            this.eventCallback()
        }, 3000)
    }

    async initialize(subscribe = true) {
        let self = this
        const prisma = getPrismaClient()
        // Connect
        if (!this.providedElectrum) await this.electrum.connect()

        // subscribe to address events
        if (subscribe) {
            this.electrum.client.subscribe.on('blockchain.scripthash.subscribe', (data) => {
                this.updateAddress(data)
            })
        }

        // load all addresses from db
        let addresses = await prisma.Address.findMany({
            select: {
                address: true,
                scriptHash: true,
                wallet: {
                    select: {
                        rootPubKey: true
                    }
                }
            }
        })

        // subscribe to all addresses, use map
        let subscriptions = addresses.map(async (address) => {
            try {
                await this.electrum.client.blockchainScripthash_subscribe(address.scriptHash)
            } catch (e) {
                console.log(e)
            }
        })

        Promise.all(subscriptions)
            .then(() => {
                console.log("All addresses subscribed")
            })
    }

    async updateGap(walletId, rootPubKey, addressDerivationPath) {
        const prisma = getPrismaClient()
        const GAP = 20

        const dP = parseDerivationPath(addressDerivationPath)
        let highestFundedAddress, highestOverallAddress

        // if (dP.change === 0 || dP.change === 1) {
        let changeType = `/` + dP.change + `/`


        function exctractDerivationIndex(derivationPath) {
            const parts = derivationPath.split('/')
            const index = parts[parts.length - 1]
            return parseInt(index, 10)
        }

        // select all addresses with non-zero balance for this pubkey
        let allAddresses = await prisma.address.findMany({
            where: {
                walletId: walletId,
            },
            select: {
                derivationPath: true,
                confirmedBalance: true,
                unconfirmedBalance: true,
            },
        })

        allAddresses = allAddresses.map((address) => {
            address.unconfirmedBalance = parseInt(address.unconfirmedBalance)
            address.confirmedBalance = parseInt(address.confirmedBalance)
            return address
        })

        let allFundedChangeTypeAddresses = allAddresses.filter((address) => {
            return address.derivationPath.indexOf(changeType) > 0 && (address.unconfirmedBalance > 0 || address.confirmedBalance > 0)
        })
        allFundedChangeTypeAddresses.sort((a, b) => {
            const numericPartA = exctractDerivationIndex(a.derivationPath)
            const numericPartB = exctractDerivationIndex(b.derivationPath)
            return numericPartB - numericPartA // For descending order
        })
        highestFundedAddress = allFundedChangeTypeAddresses[0]

        let allChangeTypeAddresses = allAddresses.filter((address) => {
            return address.derivationPath.indexOf(changeType) > 0
        })
        allChangeTypeAddresses.sort((a, b) => {
            const numericPartA = exctractDerivationIndex(a.derivationPath)
            const numericPartB = exctractDerivationIndex(b.derivationPath)
            return numericPartB - numericPartA // For descending order
        })
        highestOverallAddress = allChangeTypeAddresses[0]

        console.log(`Highest Funded ${dP.change === 0 ? 'Main' : 'Change'} Address:`, highestFundedAddress)
        console.log(`Highest Overall ${dP.change === 0 ? 'Main' : 'Change'} Address:`, highestOverallAddress)

        const HFdPath = parseDerivationPath(highestFundedAddress.derivationPath)
        const HOdPath = parseDerivationPath(highestOverallAddress.derivationPath)

        let newAddresses = []
        const gap = HOdPath.index - HFdPath.index
        if (gap < GAP) {
            console.log(`${dP.change === 0 ? 'Main' : 'Change'} gap is less than ${GAP}, increasing gap by ${GAP - gap} addresses`)
            newAddresses = await generateAddresses(
                rootPubKey,
                Array.from({ length: GAP - gap }, (_, i) => `${HFdPath.purpose}/${HFdPath.network}/${HFdPath.account}/${dP.change}/${HOdPath.index + i + 1}`),
                this.electrum
            )
        }

        return Promise.all(
            newAddresses.map(async (address) => {
                await prisma.address.create({
                    data: {
                        walletId: walletId,
                        address: address.address,
                        derivationPath: address.derivationPath,
                        scriptHash: address.scriptHash,
                        pubkey: address.pubkey,
                        unconfirmedBalance: String(address.unconfirmedBalance),
                        confirmedBalance: String(address.confirmedBalance),
                        txCount: address.txCount
                    }
                }).catch((e) => {
                    console.log("Address insert race condition, ignoring...")
                })
            })
        )
    }
}

export default AddressListener