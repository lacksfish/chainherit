import { app, ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { generateKey } from '@47ng/cloak'
import { fork } from 'child_process'

import routes from './../server/routes/routes'

import ElectrumConnection from './../server/network/electrum'
import AddressUpdater from './../server/address/addressUpdater'
import AddressListener from './../server/address/addressListener'
import { initializePrisma } from './../server/db/client'
import { getNetwork } from './../server/network/env'

const isDevelopment = !app.isPackaged

const PRISMA_ENCRYPTED_CREDENTIALS_PATH = isDevelopment ? './prisma/db.key' : path.join(app.getPath('userData'), 'db.key')
const PRISMA_ENCRYPTED_SALT_PATH = isDevelopment ? './prisma/db.salt' : path.join(app.getPath('userData'), 'db.salt')

let au // AddressUpdater | null
let al // AddressListener | null
let electrum // ElectrumConnection | null

const initAddressUpdaterAndListener = async (win) => {
    au = new AddressUpdater(electrum)
    await au.initialize()
    al = new AddressListener(electrum, (_event, _state) => {
        win?.webContents.send('event:reloadWallets', true)
    })
    await al.initialize()
}

const initElectrum = async (win) => {
    const NETWORK = getNetwork()
    try {
        electrum = new ElectrumConnection()
        // TODO check if reconnect to same server
        let settings = await routes.settings.getSettings()
        if (!settings.electrumNodeUrl || !settings.electrumNodePort) {
            // If no electrum node is set, use blockstream.info as default
            const defaultNode = ['electrum.blockstream.info', process.env.NETWORK == 'BTC' ? 50002 : 60002]
            electrum.init(defaultNode[0], defaultNode[1], NETWORK, 'ssl')
            await routes.settings.updateSettings(null, { electrumNodeUrl: defaultNode[0], electrumNodePort: defaultNode[1] })
        } else {
            electrum.init(settings.electrumNodeUrl, parseInt(settings.electrumNodePort), NETWORK, 'ssl')
        }
        electrum.connect(async () => {
            win?.webContents.send('event:electrumConnected', true)
            win?.webContents.send('event:walletSync', true)
            await initAddressUpdaterAndListener(win)
            win?.webContents.send('event:walletSync', false)
        }, () => {
            win?.webContents.send('event:electrumConnected', false)
        })
    } catch (err) {
        console.log(err)
        return {
            status: 500,
            message: err.message ? err.message : 'Unknown error'
        }
    }
    return { status: 200 }
}

const setIpcRoutes = (win) => {
    const NETWORK = getNetwork()
    ipcMain.handle('recipients:get', routes.recipients.getRecipients)
    ipcMain.handle('recipients:post', routes.recipients.addRecipients)
    ipcMain.handle('recipients:put', routes.recipients.updateRecipient)
    ipcMain.handle('recipients:delete', routes.recipients.deleteRecipient)
    ipcMain.handle('wallets:get', routes.wallets.getWallets)
    ipcMain.handle('wallets:delete', routes.wallets.deleteWallet)
    ipcMain.handle('publicKey:post', routes.wallets.addPublicKey)
    ipcMain.handle('distributions:get', routes.distributions.getDistributions)
    ipcMain.handle('distributions:post', routes.distributions.addDistribution)
    ipcMain.handle('distributions:delete', routes.distributions.deleteDistribution)
    ipcMain.handle('genTx:post', routes.transactions.generateTX)
    ipcMain.handle('signTx:post', routes.transactions.postTX)
    ipcMain.handle('txInfo:get', routes.transactions.getTxInfo)
    ipcMain.handle('settings:get', routes.settings.getSettings)

    ipcMain.handle('network:get', () => process.env.NETWORK)

    ipcMain.handle('password:post', async (_event, password) => {
        try {
            // Check if credentials file already exists
            const dbKey = checkPassword(password)
            win?.webContents.send('event:initialSetup', false)
            decryptDatabase(dbKey)

            // Connect to electrum
            initElectrum(win)
        } catch (err) {
            console.log(err)
            return {
                status: 500,
                message: err.message ? err.message : 'Unknown error'
            }
        }
        win?.webContents.send('event:passwordSuccess', true)
        return { status: 200 }
    })


    ipcMain.handle('node:connect', (_event) => {
        win?.webContents.send('event:electrumConnected', false)
        return initElectrum(win)
    })

    ipcMain.handle('node:select', async (_event, node) => {
        electrum.client.close()
        electrum.destroy()
        win?.webContents.send('event:electrumConnected', false)
        await routes.settings.updateSettings(null, { electrumNodeUrl: node[0], electrumNodePort: node[1] })
        return initElectrum(win)
    })

    ipcMain.handle('resubscribe:addresses', async (_event) => {
        if (al) {
            await al.initialize(false)
        }
    })
}

const checkPassword = (password) => {
    // Use password hash as symmetric key
    const key = password.substring(0, 32)
    if (!fs.existsSync(PRISMA_ENCRYPTED_CREDENTIALS_PATH)) {
        // Create a key for the sqlite database field encryption
        const newDbKey = generateKey()
        const iv = crypto.randomBytes(16)
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
        let encrypted = cipher.update(newDbKey, 'utf8', 'hex')
        encrypted += cipher.final('hex')
        // concat iv and the encrypted dbkey
        const output = iv.toString('hex') + ':::' + encrypted
        // Write the encrypted dbkey to file
        fs.writeFileSync(PRISMA_ENCRYPTED_CREDENTIALS_PATH, output, 'utf8')
    }
    if (!fs.existsSync(PRISMA_ENCRYPTED_SALT_PATH)) {
        // Create a key for the sqlite database field encryption
        const newSalt = generateKey()
        const iv = crypto.randomBytes(16)
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
        let encrypted = cipher.update(newSalt, 'utf8', 'hex')
        encrypted += cipher.final('hex')
        // concat iv and the encrypted dbkey
        const output = iv.toString('hex') + ':::' + encrypted
        // Write the encrypted dbkey to file
        fs.writeFileSync(PRISMA_ENCRYPTED_SALT_PATH, output, 'utf8')
    }
    return key
}

const decryptDatabase = (dbKey) => {
    // Read the encrypted dbkey from file
    const data = fs.readFileSync(PRISMA_ENCRYPTED_CREDENTIALS_PATH, 'utf8')
    const parts = data.split(':::')
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    // Decrypt the db key
    const decipher = crypto.createDecipheriv('aes-256-cbc', dbKey, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    // Read the encrypted salt from file
    const saltData = fs.readFileSync(PRISMA_ENCRYPTED_SALT_PATH, 'utf8')
    const saltParts = saltData.split(':::')
    const saltIv = Buffer.from(saltParts[0], 'hex')
    const saltEncrypted = saltParts[1]
    // Decrypt the salt
    const saltDecipher = crypto.createDecipheriv('aes-256-cbc', dbKey, saltIv)
    let saltDecrypted = saltDecipher.update(saltEncrypted, 'hex', 'utf8')
    saltDecrypted += saltDecipher.final('utf8')

    // Set db salt to environment variable (https://github.com/47ng/prisma-field-encryption)
    process.env.PRISMA_FIELD_ENCRYPTION_HASH_SALT = saltDecrypted

    initializePrisma(decrypted)
}

const platformToExecutables = {
    win32: {
        migrationEngine: './node_modules/@prisma/engines/schema-engine-windows.exe',
        queryEngine: './node_modules/@prisma/engines/query_engine-windows.dll.node'
    },
    linux: {
        migrationEngine: './node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x',
        queryEngine: './node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node'
    },
    darwin: {
        migrationEngine: './node_modules/@prisma/engines/schema-engine-darwin-arm64',
        queryEngine: './node_modules/@prisma/engines/libquery_engine-darwin-arm64.dylib.node'
    }
}

// Based on: https://github.com/prisma/prisma/issues/9613#issuecomment-970743002
async function runPrismaCommand(command, dbUrl) {

    const PRISMA_SCHEMA_ENGINE_LIBRARY =
        isDevelopment ? platformToExecutables[process.platform].migrationEngine : path.join(app.getAppPath().replace('app.asar', 'app.asar.unpacked'), platformToExecutables[process.platform].migrationEngine)

    const PRISMA_QUERY_ENGINE_LIBRARY =
        isDevelopment ? platformToExecutables[process.platform].queryEngine : path.join(app.getAppPath().replace('app.asar', 'app.asar.unpacked'), platformToExecutables[process.platform].queryEngine)

    const PRISMA_SCHEMA_PATH = isDevelopment ? './prisma/schema.prisma' : path.join(app.getAppPath(), '..', '..', 'prisma', 'schema.prisma')

    try {
        const exitCode = await new Promise((resolve, _) => {
            const prismaPath = isDevelopment ? path.resolve("./node_modules/prisma/build/index.js") : path.resolve(__dirname, "..", "..", "prisma/build/index.js")

            const child = fork(
                prismaPath,
                command.concat(["--schema", PRISMA_SCHEMA_PATH]),
                {
                    env: {
                        ...process.env,
                        DATABASE_URL: dbUrl,
                        PRISMA_SCHEMA_ENGINE_BINARY: PRISMA_SCHEMA_ENGINE_LIBRARY,
                        PRISMA_QUERY_ENGINE_LIBRARY: PRISMA_QUERY_ENGINE_LIBRARY
                    },
                    stdio: "inherit"
                }
            )

            child.on("error", err => {
                console.error("Child process got error:", err)
            })

            child.on("close", (code, signal) => {
                resolve(code)
            })
        })

        if (exitCode !== 0) throw Error(`command ${command} failed with exit code ${exitCode}`)

        return exitCode
    } catch (e) {
        console.error(e)
        throw e
    }
}

export {
    setIpcRoutes,
    checkPassword,
    decryptDatabase,
    runPrismaCommand
}