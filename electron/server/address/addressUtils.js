import { getPrismaClient } from './../db/client'
import { generateAddresses } from '../wallet/walletutils'

export function compareUtxos(utxo1, utxo2) {
    const txHash1 = utxo1.txHash || utxo1.tx_hash
    const txHash2 = utxo2.txHash || utxo2.tx_hash

    const txOutputN1 = utxo1.txOutputN || utxo1.tx_output_n
    const txOutputN2 = utxo2.txOutputN || utxo2.tx_output_n

    const blockHeight1 = utxo1.blockHeight || utxo1.block_height
    const blockHeight2 = utxo2.blockHeight || utxo2.block_height

    const txRaw1 = utxo1.txRaw || utxo1.raw
    const txRaw2 = utxo2.txRaw || utxo2.raw

    return txHash1 == txHash2 && txOutputN1 == txOutputN2 &&
        utxo1.value == utxo2.value && blockHeight1 == blockHeight2 &&
        utxo1.scriptPubKey == utxo2.scriptPubKey && txRaw1 == txRaw2
}

export async function updateOrInsertUtxos(newUtxos, outdatedUtxos, addressId) {
    const prisma = getPrismaClient()
    // Insert new UTXOs
    if (newUtxos.length > 0) {
        for (const utxo of newUtxos) {
            await prisma.uTXO.create({
                data: {
                    txHash: String(utxo.tx_hash),
                    txOutputN: String(utxo.tx_output_n),
                    value: String(utxo.value),
                    blockHeight: String(utxo.block_height),
                    scriptPubKey: String(utxo.scriptPubKey),
                    txRaw: String(utxo.raw),
                    addressId: addressId
                }
            });
        }
    }

    // Delete outdated UTXOs
    for (const utxo of outdatedUtxos) {
        await prisma.uTXO.deleteMany({
            where: {
                txHash: String(utxo.txHash),
                txOutputN: String(utxo.txOutputN),
                value: String(utxo.value),
                blockHeight: String(utxo.blockHeight),
                scriptPubKey: String(utxo.scriptPubKey),
                txRaw: String(utxo.txRaw)
            }
        });
    }
}

export async function upsertAddress(address, walletId) {
    const prisma = getPrismaClient()
    let query = await prisma.address.upsert({
        where: { address: address.address },
        update: {
            unconfirmedBalance: String(address.unconfirmedBalance),
            confirmedBalance: String(address.confirmedBalance),
            txCount: address.txCount
        },
        create: {
            walletId: walletId,
            address: address.address,
            derivationPath: address.derivationPath,
            scriptHash: address.scriptHash,
            pubkey: address.pubkey,
            unconfirmedBalance: String(address.unconfirmedBalance),
            confirmedBalance: String(address.confirmedBalance),
            txCount: address.txCount
        }
    })
    return query
}