import { getPrismaClient } from './../../db/client'
import validate from './../../validation/validation'

const getSettings = async () => {
    const prisma = getPrismaClient()
    try {
        let settings = await prisma.settings.findMany({
            select: {
                name: true,
                value: true
            },
            where: {
                OR: [
                    {
                        name: 'electrumNodeUrl'
                    }, {
                        name: 'electrumNodePort'
                    }
                ]
            }
        })
        // array to key-val obj
        return settings.reduce((obj, item) => {
            obj[item.name] = item.value
            return obj
        }, {})
    } catch (err) {
        return {
            status: 500,
            message: err.message ? err.message : 'Unknown error'
        }
    }
}

const updateSettings = async (event, req) => {
    const prisma = getPrismaClient()
    const valid = validate.updateSettings(req)
    if (!valid) {
        let errors = []
        validate.updateSettings.errors.map((error) => {
            if (error.instancePath == '/electrumNodeUrl') {
                errors.push("Node url is invalid")
            }
            if (error.instancePath == '/electrumNodePort') {
                errors.push('Node port is invalid')
            }
        })
        return {
            status: 422,
            errors: errors
        }
    }

    // Update settings
    let query = await prisma.settings.upsert({
        where: {
            name: 'electrumNodeUrl'
        },
        update: {
            value: req.electrumNodeUrl
        },
        create: {
            name: 'electrumNodeUrl',
            value: req.electrumNodeUrl
        }
    })

    query = await prisma.settings.upsert({
        where: {
            name: 'electrumNodePort'
        },
        update: {
            value: String(req.electrumNodePort)
        },
        create: {
            name: 'electrumNodePort',
            value: String(req.electrumNodePort)
        }
    })

    if (query) {
        return { status: 200 }
    } else {
        return { status: 422 }
    }
}

export default {
    getSettings,
    updateSettings
}