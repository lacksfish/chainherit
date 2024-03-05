import * as bitcoin from 'bitcoinjs-lib'
import recipients from './recipients'
import { getPrismaClient } from './../../db/client'
import validate from './../../validation/validation'
import { getNetwork, isTestnet } from './../../network/env'

jest.mock('./../../db/client', () => ({
    getPrismaClient: jest.fn(),
}))

jest.mock('./../../network/env', () => ({
    getNetwork: jest.fn(),
    isTestnet: jest.fn(),
}))

// jest.mock('./../../validation/validation', () => ({
//   updateRecipient: jest.fn(),
//   deleteRecipient: jest.fn(),
// }))

describe('Recipients', () => {
    let prismaMock

    beforeEach(() => {
        prismaMock = {
            recipient: {
                findMany: jest.fn(),
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            },
            distributionShare: {
                findFirst: jest.fn(),
            },
        }
        getPrismaClient.mockReturnValue(prismaMock)

        getNetwork.mockReturnValue(bitcoin.networks.testnet)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('getRecipients', () => {
        it('should fetch recipients', async () => {
            prismaMock.recipient.findMany.mockResolvedValue([])
            const result = await recipients.getRecipients()
            expect(result).toEqual([])
            expect(prismaMock.recipient.findMany).toHaveBeenCalled()
        })
    })

    describe('addRecipients', () => {
        it('should add a recipient successfully', async () => {
            prismaMock.recipient.findFirst.mockResolvedValue(null)
            prismaMock.recipient.create.mockResolvedValue({})

            const req = { address: 'mtkbaiLiUH3fvGJeSzuN3kUgmJzqinLejJ', label: 'valid_label' }
            const result = await recipients.addRecipients(null, req)
            expect(result).toEqual({ status: 200 })
            expect(prismaMock.recipient.create).toHaveBeenCalled()
        })

        it('should fail adding a recipient due to validation error', async () => {
            const req = { address: 'invalid_address', label: 'valid_label' }
            const result = await recipients.addRecipients(null, req)
            expect(result.status).toEqual(422)
            expect(result.errors).toContain('Address is invalid')
        })
    })

    describe('updateRecipient', () => {
        // Example test for updateRecipient
        it('should update a recipient successfully', async () => {
            prismaMock.recipient.update.mockResolvedValue({})

            const req = { oldAddress: 'mtkbaiLiUH3fvGJeSzuN3kUgmJzqinLejJ', oldLabel: 'old_label', address: 'mtkbaiLiUH3fvGJeSzuN3kUgmJzqinLejJ', label: 'new_label' }
            const result = await recipients.updateRecipient(null, req)
            expect(result).toEqual({ status: 200 })
            expect(prismaMock.recipient.update).toHaveBeenCalled()
        })
    })

    describe('deleteRecipient', () => {
        // Example test for deleteRecipient
        it('should delete a recipient successfully', async () => {
            prismaMock.recipient.findUnique.mockResolvedValue({ id: 1 })
            prismaMock.distributionShare.findFirst.mockResolvedValue(null)
            prismaMock.recipient.delete.mockResolvedValue({})

            const req = { address: 'mtkbaiLiUH3fvGJeSzuN3kUgmJzqinLejJ', label: 'label_to_delete' }
            const result = await recipients.deleteRecipient(null, req)
            expect(result).toEqual({ status: 200 })
            expect(prismaMock.recipient.delete).toHaveBeenCalled()
        })
    })
})
