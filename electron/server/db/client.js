import { PrismaClient } from '@prisma/client'
import { fieldEncryptionExtension } from 'prisma-field-encryption'

let globalClient
let isInitialized = false

function initializePrisma(encryptionKey) {
    console.log("Initializing Prisma client")
    globalClient = new PrismaClient()
        .$extends(
            fieldEncryptionExtension({
                encryptionKey: encryptionKey,
            })
        )
    isInitialized = true
    return globalClient
}

function getPrismaClient() {
    if (!isInitialized) {
        throw new Error("Prisma client is not initialized yet.")
    }
    return globalClient
}

export { initializePrisma, getPrismaClient }