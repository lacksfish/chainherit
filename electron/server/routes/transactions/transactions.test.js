import * as bitcoin from 'bitcoinjs-lib'
import { getNetwork, isTestnet } from './../../network/env'
import { getPrismaClient } from './../../db/client'
import validate from './../../validation/validation'
import transactions from './transactions'
import { generateUnsignedTransaction } from './../../wallet/walletutils'
import redish from './../../db/redish'

jest.mock('./../../db/client', () => ({
    getPrismaClient: jest.fn(),
}))

jest.mock('./../../network/env', () => ({
    getNetwork: jest.fn(),
    isTestnet: jest.fn(),
}))

jest.mock('./../../wallet/walletutils', () => ({
    generateUnsignedTransaction: jest.fn(),
}))

jest.mock('./../../db/redish', () => ({
    set: jest.fn(),
    get: jest.fn(),
}))

describe('Transactions', () => {
    let prismaMock

    beforeEach(() => {
        prismaMock = {
            settings: {
                findMany: jest.fn(),
                upsert: jest.fn(),
            },
            Wallet: {
                findFirst: jest.fn(),
            },
            TransactionSigned: {
                findFirst: jest.fn(),
                create: jest.fn(),
            },
            recipient: {
                findFirst: jest.fn(),
            },
            distribution: {
                findUnique: jest.fn(),
            },
        }
        getPrismaClient.mockReturnValue(prismaMock)
        getNetwork.mockReturnValue(bitcoin.networks.testnet)
        isTestnet.mockReturnValue(true)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('getTxInfo', () => {

        it('should handle wallet not found', async () => {
            // Mock Prisma client to simulate "wallet not found"
            const prismaMock = {
                Wallet: {
                    findFirst: jest.fn().mockResolvedValue(null),
                },
            }
            getPrismaClient.mockReturnValue(prismaMock)

            const result = await transactions.getTxInfo(null, { walletLabel: 'nonexistent' })
            expect(result).toEqual({ status: 422, errors: ['Wallet not found'] })
        })

        it('should successfully fetch transaction info', async () => {
            // Mock wallet and transaction retrieval
            prismaMock.Wallet.findFirst.mockResolvedValue({
                id: 1,
                rootPubKey: 'vpub5UoXEXDGqB8WqytCCZ9rZ5sooP6aKc5LjEyXAgRL6hF6k18RkR4RYVV4BTa6gbdfhESG9upyrqYLgq2vD5JkCRvsJNHLVyf2tDD4aLcyo9z',
                label: 'Test Wallet',
            })
            prismaMock.TransactionSigned.findFirst.mockResolvedValue({
                id: 1,
                transaction: '02000000000101db33bfef332834606410ca65c0e9fc61acba9e6a54ab65d337394275a5e342080000000000fdffffff0200e1f50500000000160014008ef331ac3ccf38264d4d2ff6d3d0170e468b92d4e7a4350000000016001465566c6c307d10d100105a0caea10754886bb47c0247304402207e32b0a76a6d938d4388eaebf1cb4bacacc0dc6ef6c4cb9c514d2479f3a6d357022026e4346440c88d0439449a8ff025591eaf87b41112d09d12f0015cdd7e1700e601210367e68e7c305d61d05b5a428e2d5d677c2ad8b46a20a89f91872fa8725cec104b755e2700',
                locktime: 0,
                totalAmount: '1000',
            })
            prismaMock.recipient.findFirst.mockResolvedValue({
                label: 'Test Recipient',
                address: 'mtkbaiLiUH3fvGJeSzuN3kUgmJzqinLejJ',
            })

            const result = await transactions.getTxInfo(null, { walletLabel: 'Test Wallet' })
            expect(result.status).toEqual(200)
            expect(result.outputs).toBeDefined()
            expect(result.transaction).toEqual('02000000000101db33bfef332834606410ca65c0e9fc61acba9e6a54ab65d337394275a5e342080000000000fdffffff0200e1f50500000000160014008ef331ac3ccf38264d4d2ff6d3d0170e468b92d4e7a4350000000016001465566c6c307d10d100105a0caea10754886bb47c0247304402207e32b0a76a6d938d4388eaebf1cb4bacacc0dc6ef6c4cb9c514d2479f3a6d357022026e4346440c88d0439449a8ff025591eaf87b41112d09d12f0015cdd7e1700e601210367e68e7c305d61d05b5a428e2d5d677c2ad8b46a20a89f91872fa8725cec104b755e2700')
        })
    })

    describe('generateTX', () => {

        it('should validate input and return error', async () => {
            const result = await transactions.generateTX(null, { /* Invalid request data */ })
            expect(result.status).toEqual(422)
        })

        it('should successfully generate a transaction', async () => {
            // Mock wallet and distribution lookup
            prismaMock.Wallet.findFirst.mockResolvedValue({
                rootPubKey: 'vpub5UoXEXDGqB8WqytCCZ9rZ5sooP6aKc5LjEyXAgRL6hF6k18RkR4RYVV4BTa6gbdfhESG9upyrqYLgq2vD5JkCRvsJNHLVyf2tDD4aLcyo9z',
            })
            prismaMock.distribution.findUnique.mockResolvedValue({
                label: 'Test Distribution',
                distShares: [
                    { recipient: { label: 'Recipient 1', address: 'mtkbaiLiUH3fvGJeSzuN3kUgmJzqinLejJ', percentage: 50 } },
                    { recipient: { label: 'Recipient 2', address: 'mtkbaiLiUH3fvGJeSzuN3kUgmJzqinLejJ', percentage: 50 } },
                ],
            })

            generateUnsignedTransaction.mockResolvedValue({
                status: 200,
                unsigned: "02000000000101...",
                totalValue: 1000,
                unconfirmedInputs: false
            })
            redish.set.mockResolvedValue('OK')

            const req = { walletLabel: 'Test Wallet', distLabel: 'Test Distribution', validityDate: (new Date()).toISOString(), txFee: 100 }
            const result = await transactions.generateTX(null, req)

            expect(result.status).toEqual(200)
            expect(result.unsignedTx).toBeDefined()
        })

    })

    describe('postTX', () => {
        it('should return error when walletLabel or distLabel is invalid', async () => {
            const result = await transactions.postTX(null, {
                walletLabel: 'walletLabel',
                distLabel: 'distLabel',
                validityDate: (new Date()).toISOString(),
                txFee: 50
            })
            expect(result.status).toEqual(422)
        })

        // TODO more tests for posting tx
    })
})
