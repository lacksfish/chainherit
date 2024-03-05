import * as bitcoin from 'bitcoinjs-lib'
import distributions from './distributions'
import validate from './../../validation/validation'
import { getPrismaClient } from './../../db/client'
import { getNetwork, isTestnet } from './../../network/env'

jest.mock('./../../db/client', () => ({
    getPrismaClient: jest.fn(),
}))

jest.mock('./../../network/env', () => ({
    getNetwork: jest.fn(),
    isTestnet: jest.fn(),
}))

describe('Distributions', () => {
    let prismaMock

    beforeEach(() => {
        prismaMock = {
            distribution: {
                findMany: jest.fn(),
                create: jest.fn(),
                delete: jest.fn(),
                findFirst: jest.fn(),
            },
            distributionShare: {
                create: jest.fn(),
                deleteMany: jest.fn(),
            },
            recipient: {
                findFirst: jest.fn(),
            },
            $transaction: jest.fn(),
        }
        getPrismaClient.mockReturnValue(prismaMock)

        isTestnet.mockReturnValue(true)
        getNetwork.mockReturnValue(bitcoin.networks.testnet)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('getDistributions', () => {
        it('should fetch distributions', async () => {
            prismaMock.distribution.findMany.mockResolvedValue([])
            const result = await distributions.getDistributions()
            expect(result).toEqual([])
            expect(prismaMock.distribution.findMany).toHaveBeenCalled()
        })
    })

    describe('addDistribution', () => {
        it('should add a distribution', async () => {
            prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
            prismaMock.distribution.create.mockResolvedValue({ id: 1 })
            prismaMock.recipient.findFirst.mockResolvedValue({ id: 1 })
            prismaMock.distributionShare.create.mockResolvedValue({})

            const req = {
                label: 'Test Distribution',
                distribution: [
                    { label: 'Recipient 1', address: 'mtkbaiLiUH3fvGJeSzuN3kUgmJzqinLejJ', percentage: 50 },
                    { label: 'Recipient 2', address: 'mta9XPJKQN3mQSRYA8yMSLdGTtt13JUpQS', percentage: 50 },
                ],
            }
            const result = await distributions.addDistribution(null, req)
            expect(result).toEqual({ status: 200 })
            expect(prismaMock.distribution.create).toHaveBeenCalled()
            expect(prismaMock.distributionShare.create).toHaveBeenCalledTimes(req.distribution.length)
        })

        it('should fail adding a distribution (invalid address)', async () => {
            prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
            prismaMock.distribution.create.mockResolvedValue({ id: 1 })
            prismaMock.recipient.findFirst.mockResolvedValue({ id: 1 })
            prismaMock.distributionShare.create.mockResolvedValue({})

            const req = {
                label: 'Test Distribution',
                distribution: [
                    { label: 'Recipient 1', address: 'Address 1', percentage: 50 },
                    { label: 'Recipient 2', address: 'Address 2', percentage: 50 },
                ],
            }
            const result = await distributions.addDistribution(null, req)
            expect(result).toEqual({ status: 422, errors: ["Distribution is invalid"] })
            expect(prismaMock.distribution.create).toHaveBeenCalledTimes(0)
            expect(prismaMock.distributionShare.create).toHaveBeenCalledTimes(0)
        })
    })

    describe('deleteDistribution', () => {
        it('should delete a distribution', async () => {
            prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock))
            prismaMock.distribution.findFirst.mockResolvedValue({ id: 1 })
            prismaMock.distributionShare.deleteMany.mockResolvedValue({})
            prismaMock.distribution.delete.mockResolvedValue({})

            const req = { deleteLabel: 'Test Distribution' }
            const result = await distributions.deleteDistribution(null, req)
            expect(result).toEqual({ status: 200 })
            expect(prismaMock.distribution.delete).toHaveBeenCalled()
        })
    })
})
