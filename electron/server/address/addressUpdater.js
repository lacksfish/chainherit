import { generateAddresses } from '../wallet/walletutils'
import { getPrismaClient } from '../db/client'
import { compareUtxos, upsertAddress, updateOrInsertUtxos } from './addressUtils'

class AddressUpdater {

    electrum = null
    providedElectrum = false

    constructor(electrum) {
        if (electrum) {
            this.providedElectrum = true
            this.electrum = electrum
        } else {
            throw Error('Electrum connection is required')
        }

        this.electrum.addEventListener('reconnectEvent', () => {
            this.initialize()
        })
    }

    async initialize() {
        let self = this
        const prisma = getPrismaClient()
        await this.electrum.connect()

        // load all rootPubKeys from db
        let wallets = await prisma.wallet.findMany({
            select: {
                id: true,
                rootPubKey: true
            }
        })

        // for each wallet
        return Promise.all(wallets.map(async (wallet) => {
            // Get current wallet addresses state
            let walletAddresses = await prisma.address.findMany({
                where: {
                    walletId: wallet.id
                },
                select: {
                    id: true,
                    address: true,
                    derivationPath: true,
                    scriptHash: true,
                    pubkey: true,
                    unconfirmedBalance: true,
                    confirmedBalance: true,
                    txCount: true,
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

            // tmp object, indexed walletAddresses by address for fast lookup
            let prevAddresses = walletAddresses.reduce((obj, item) => {
                obj[item.address] = item
                return obj
            }, {})

            // initialize again
            let currAddresses = await generateAddresses(wallet.rootPubKey, null, self.electrum)

            let invalidateTx = false

            let res = await Promise.all(currAddresses.map(async (currAddress) => {
                let prevAddress = prevAddresses[currAddress.address]
                let prevAddressUTXOs = prevAddress ? prevAddress.utxos : []

                // Find new utxos
                let newUtxos = currAddress.utxos.filter((utxo) => {
                    return !prevAddressUTXOs.some((addressUtxo) => compareUtxos(addressUtxo, utxo))
                })

                // Find spent utxos
                let spentUtxos = prevAddressUTXOs.filter((addressUtxo) => {
                    return !currAddress.utxos.some((utxo) => compareUtxos(addressUtxo, utxo))
                })

                // Insert new utxos and delete outdated utxos
                if (newUtxos.length > 0 || spentUtxos.length > 0) {
                    if (spentUtxos.length > 0) {
                        // TODO, alert when new utxo (in newUTXOs) is found. doesnt invalidate prev tx, but is not inherited
                        invalidateTx = true
                    }
                    await updateOrInsertUtxos(newUtxos, spentUtxos, prevAddresses[currAddress.address].id)
                }

                // Upsert address balances and txCount
                await upsertAddress(currAddress, wallet.id)
            }))

            if (invalidateTx) {
                let activeInheritance = await prisma.Address.findFirst({
                    where: {
                        walletId: wallet.id
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
                if (activeInheritance.wallet.transaction.length > 0) {
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
            }

            return res
        }))
    }
}

export default AddressUpdater
