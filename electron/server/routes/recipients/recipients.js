import { getPrismaClient } from './../../db/client'
import validate from './../../validation/validation'

const getRecipients = async () => {
    const prisma = getPrismaClient()
    let recipients = await prisma.recipient.findMany({
        select: {
            address: true,
            label: true
        },
    })

    return recipients
}

const addRecipients = async (event, req) => {
    const prisma = getPrismaClient()
    const valid = validate.addRecipient(req)
    if (!valid) {
        let errors = []
        validate.addRecipient.errors.map((error) => {
            if (error.instancePath == '/address') {
                errors.push("Address is invalid")
            }
            if (error.instancePath == '/label') {
                errors.push(`Label is invalid (${error.message})`)
            }
        })
        return {
            status: 422,
            errors: errors
        }
    }

    // Check if label or address exists
    let query = await prisma.recipient.findFirst({
        where: {
            OR: [
                {
                    address: req.address
                }, {
                    label: req.label
                }
            ]
        },
        select: {
            id: true
        },
    })

    if (query) {
        return {
            status: 409
        }
    }

    // Create new recipient
    query = await prisma.recipient.create({
        data: {
            address: req.address,
            label: req.label
        }
    })

    if (query) {
        return {
            status: 200
        }
        return
    } else {
        return {
            status: 422
        }
    }
}

var updateRecipient = async (event, req) => {
    const prisma = getPrismaClient()
    const valid = validate.updateRecipient(req)
    if (!valid) {
        let errors = []
        validate.updateRecipient.errors.map((error) => {
            if (error.instancePath == '/address') {
                errors.push("Address is invalid")
            }
            if (error.instancePath == '/label') {
                errors.push(`Label is invalid (${error.message})`)
            }
        })
        return {
            status: 422,
            errors: errors
        }
    }

    // Edit recipient
    try {
        let query = await prisma.recipient.update({
            where: {
                addressLabelUnique:
                {
                    address: req.oldAddress,
                    label: req.oldLabel
                }
            },
            data: {
                label: req.label,
                address: req.address
            }
        })

        if (query) {
            return { status: 200 }
        } else {
            return { status: 422 }
        }
    } catch (e) {
        return { status: 409 }
    }
}

var deleteRecipient = async (event, req) => {
    const prisma = getPrismaClient()
    const valid = validate.deleteRecipient(req)
    if (!valid) {
        let errors = []
        validate.deleteRecipient.errors.map((error) => {
            if (error.instancePath == '/address') {
                errors.push("Address is invalid")
            }
            if (error.instancePath == '/label') {
                errors.push("Label is invalid")
            }
        })
        return {
            status: 422,
            errors: errors
        }
    }

    // Delete recipient
    let query = await prisma.recipient.findUnique({
        where: {
            addressLabelUnique:
            {
                address: req.address,
                label: req.label
            }
        },
        select: {
            id: true
        }
    })

    if (query) {
        query = await prisma.distributionShare.findFirst({
            where: {
                recipientId: query.id
            }
        })

        if (!query) {
            query = await prisma.recipient.delete({
                where: {
                    addressLabelUnique:
                    {
                        address: req.address,
                        label: req.label
                    }
                }
            })

            if (query) {
                return { status: 200 }
            }
        } else {
            return {
                status: 409,
                errors: ["Recipient is still used in a distribution. Can't delete the recipient!"]
            }
        }
    } else {
        return { status: 422 }
    }
}


export default {
    getRecipients,
    addRecipients,
    updateRecipient,
    deleteRecipient
}