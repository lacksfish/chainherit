import * as bitcoin from 'bitcoinjs-lib'
import wallets from './wallets'
import { getPrismaClient } from './../../db/client'
import { getNetwork, isTestnet } from './../../network/env'
import validate from './../../validation/validation'
import { generateAddresses } from './../../wallet/walletutils'

jest.mock('./../../db/client', () => ({
    getPrismaClient: jest.fn(),
}))

jest.mock('./../../network/env', () => ({
    getNetwork: jest.fn(),
    isTestnet: jest.fn(),
}))

jest.mock('./../../wallet/walletutils', () => ({
    generateAddresses: jest.fn(),
}))

let prismaMock

beforeEach(() => {
    prismaMock = {
        wallet: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            delete: jest.fn(),
            create: jest.fn(),
        },
        transactionSigned: {
            deleteMany: jest.fn(),
        },
        UTXO: {
            deleteMany: jest.fn(),
        },
        address: {
            deleteMany: jest.fn(),
            create: jest.fn(),
        },
        $transaction: jest.fn()
    }
    getPrismaClient.mockReturnValue(prismaMock)
    getNetwork.mockReturnValue(bitcoin.networks.testnet)
    isTestnet.mockReturnValue(true)
})

describe('Wallets', () => {
    describe('getWallets', () => {
        it('should fetch wallets successfully', async () => {
            prismaMock.wallet.findMany.mockResolvedValue([
                {
                    rootPubKey: 'vpub5UoXEXDGqB8WqytCCZ9rZ5sooP6aKc5LjEyXAgRL6hF6k18RkR4RYVV4BTa6gbdfhESG9upyrqYLgq2vD5JkCRvsJNHLVyf2tDD4aLcyo9z',
                    label: 'Wallet 1',
                    transaction: [{
                        totalAmount: '1000',
                        locktime: 0,
                        createdAt: new Date(),
                    }],
                    addresses: [{
                        address: 'mtkbaiLiUH3fvGJeSzuN3kUgmJzqinLejJ',
                        confirmedBalance: 5000,
                        unconfirmedBalance: 1000,
                        pubkey: 'pubkey1...',
                        derivationPath: 'm/0/1',
                        scriptHash: 'scriptHash1...',
                    }],
                },
            ])

            const result = await wallets.getWallets()
            expect(result).toHaveLength(1)
            expect(result[0].label).toEqual('Wallet 1')
            expect(prismaMock.wallet.findMany).toHaveBeenCalled()
        })
    })

    describe('deleteWallet', () => {
        it('should delete a wallet successfully', async () => {
            validate.deleteWallet = jest.fn(() => true)
            prismaMock.wallet.findUnique.mockResolvedValue({ id: 1 })
            prismaMock.$transaction.mockResolvedValue({})

            const req = { walletLabel: 'Wallet 1' }
            const result = await wallets.deleteWallet(null, req)
            expect(result.status).toEqual(200)
            expect(prismaMock.$transaction).toHaveBeenCalled()
        })
    })

    describe('addPublicKey', () => {
        it('should add a new public key successfully', async () => {
            validate.addPublicKey = jest.fn(() => true)
            prismaMock.wallet.findMany.mockResolvedValue([])
            prismaMock.wallet.create.mockResolvedValue({
                id: 1,
                rootPubKey: 'vpub5UoXEXDGqB8WqytCCZ9rZ5sooP6aKc5LjEyXAgRL6hF6k18RkR4RYVV4BTa6gbdfhESG9upyrqYLgq2vD5JkCRvsJNHLVyf2tDD4aLcyo9z',
                label: 'New Wallet',
            })

            const req = {
                publicKey: 'vpub5UoXEXDGqB8WqytCCZ9rZ5sooP6aKc5LjEyXAgRL6hF6k18RkR4RYVV4BTa6gbdfhESG9upyrqYLgq2vD5JkCRvsJNHLVyf2tDD4aLcyo9z',
                publicKeyLabel: 'New Wallet',
            }

            generateAddresses.mockResolvedValue([])

            const result = await wallets.addPublicKey(null, req)
            expect(result.status).toEqual(200)
            expect(prismaMock.wallet.create).toHaveBeenCalled()
        })
    })
})
