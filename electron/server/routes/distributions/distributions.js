import { getPrismaClient } from './../../db/client'

// Validation
import validate from './../../validation/validation'

const getDistributions = async (event) => {
    const prisma = getPrismaClient()
    let query = await prisma.distribution.findMany({
        select: {
            label: true,
            distShares: {
                select: {
                    recipient: {
                        select: {
                            label: true,
                            address: true
                        }
                    },
                    percentage: true
                },
            },
        },
    })

    return query
}

const addDistribution = async (event, req) => {
    const prisma = getPrismaClient()
    const valid = validate.addDistribution(req)
    if (!valid) {
        let errors = []
        validate.addDistribution.errors.map((error) => {
            if (error.instancePath == '/distribution' || error.keyword == 'coinaddress') {
                errors.push("Distribution is invalid")
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

    let totalPercentage = req.distribution.reduce((sum, distRecipient) => sum + distRecipient.percentage, 0)
    if (totalPercentage < 99.7 || totalPercentage > 100) {
        return {
            status: 422
        }
    }

    let result = null
    try {
        result = await prisma.$transaction(async (prisma) => {
            const dist = await prisma.distribution.create({
                data: {
                    label: req.label
                }
            })

            let distributionId = dist.id
            let querySuccessCount = 0
            await Promise.all(req.distribution.map(async (distRecipient) => {
                let query = await prisma.recipient.findFirst({
                    where: {
                        OR: [
                            {
                                address: distRecipient.address
                            }, {
                                label: distRecipient.label
                            }
                        ],
                    },
                    select: {
                        id: true
                    },
                })

                if (query) {
                    let recipientId = query.id
                    query = await prisma.distributionShare.create({
                        data: {
                            recipientId: recipientId,
                            distributionId: distributionId,
                            percentage: String(distRecipient.percentage)
                        }
                    })
                    if (query) {
                        querySuccessCount += 1
                    }
                }
            }))
            return querySuccessCount == req.distribution.length
        })
    } catch (e) {
        console.error(e)
        return { status: 409 }
    }

    if (result) {
        return { status: 200 }
    } else {
        return { status: 422 }
    }
}

const deleteDistribution = async (event, req) => {
    const prisma = getPrismaClient()
    const valid = validate.deleteDistribution(req)
    if (!valid) {
        return {
            status: 422
        }
    }

    try {
        const result = await prisma.$transaction(async (prisma) => {
            let query = await prisma.distribution.findFirst({
                select: {
                    id: true
                },
                where: {
                    label: req.deleteLabel
                }
            })

            query = await prisma.distributionShare.deleteMany({
                where: {
                    distributionId: query.id
                }
            })

            query = await prisma.distribution.delete({
                where: {
                    label: req.deleteLabel
                }
            })
        })
        return { status: 200 }
    } catch (e) {
        console.error(e)
        return { status: 422 }
    }
}

export default {
    getDistributions,
    addDistribution,
    deleteDistribution
}