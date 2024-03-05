import settings from './settings'
import { getPrismaClient } from './../../db/client'
import validate from './../../validation/validation'

jest.mock('./../../db/client', () => ({
    getPrismaClient: jest.fn(),
}))

jest.mock('./../../validation/validation', () => ({
    updateSettings: jest.fn(),
}))

describe('Settings', () => {
    let prismaMock

    beforeEach(() => {
        prismaMock = {
            settings: {
                findMany: jest.fn(),
                upsert: jest.fn(),
            },
        }
        getPrismaClient.mockReturnValue(prismaMock)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('getSettings', () => {
        it('should fetch settings successfully', async () => {
            prismaMock.settings.findMany.mockResolvedValue([
                { name: 'electrumNodeUrl', value: 'http://localhost' },
                { name: 'electrumNodePort', value: '50001' },
            ])
            const result = await settings.getSettings()
            expect(result).toEqual({
                electrumNodeUrl: 'http://localhost',
                electrumNodePort: '50001',
            })
            expect(prismaMock.settings.findMany).toHaveBeenCalled()
        })

        it('should handle error while fetching settings', async () => {
            prismaMock.settings.findMany.mockRejectedValue(new Error('Unknown error'))
            const result = await settings.getSettings()
            expect(result).toEqual({
                status: 500,
                message: 'Unknown error',
            })
        })
    })

    describe('updateSettings', () => {
        it('should update settings successfully', async () => {
            validate.updateSettings.mockReturnValue(true)
            prismaMock.settings.upsert.mockResolvedValueOnce({ name: 'electrumNodeUrl', value: 'http://localhost' })
            prismaMock.settings.upsert.mockResolvedValueOnce({ name: 'electrumNodePort', value: '50001' })

            const req = {
                electrumNodeUrl: 'http://localhost',
                electrumNodePort: 50001,
            }
            const result = await settings.updateSettings(null, req)
            expect(result).toEqual({ status: 200 })
            expect(prismaMock.settings.upsert).toHaveBeenCalledTimes(2)
        })

        it('should return error if validation fails', async () => {
            validate.updateSettings.mockReturnValue(false)
            validate.updateSettings.errors = [
                { instancePath: '/electrumNodeUrl', message: '' },
                { instancePath: '/electrumNodePort', message: '' },
            ]

            const req = {
                electrumNodeUrl: '',
                electrumNodePort: '',
            }
            const result = await settings.updateSettings(null, req)
            expect(result.status).toEqual(422)
            expect(result.errors).toContain('Node url is invalid')
            expect(result.errors).toContain('Node port is invalid')
            expect(prismaMock.settings.upsert).toHaveBeenCalledTimes(0)
        })
    })
})
