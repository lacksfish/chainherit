// Import external modules
import { app, BrowserWindow, globalShortcut, shell, screen } from 'electron'
import minimist from 'minimist'
import path from 'node:path'
import * as fs from 'fs'

// Argument parsing if packaged app
const isDevelopment = !app.isPackaged
const argv = minimist(process.argv.slice(1))

if (isDevelopment) {
    // if process.env.network is neither BTC nor TBTC, throw an error and exit
    if (process.env.NETWORK !== 'BTC' && process.env.NETWORK !== 'TBTC') {
        console.error('Invalid network environment variable, process.env.NETWORK must be "BTC" for mainnet or "TBTC" for testnet. Exiting.')
        process.exit(1)
    }
} else {
    process.env.NETWORK = argv.testnet ? 'TBTC' : 'BTC'
}

// Import local modules
import { runPrismaCommand, setIpcRoutes } from './initialisation/init'

// Prisma database setup
const PRISMA_ENCRYPTED_CREDENTIALS_PATH = isDevelopment ? './prisma/db.key' : path.join(app.getPath('userData'), 'db.key')
const PRISMA_DB_URL = isDevelopment ? `file:./${process.env.NETWORK}.db?connection_limit=1` : 'file:' + path.join(app.getPath('userData'), `${process.env.NETWORK}.db?connection_limit=1`)
process.env.PRISMA_DB_URL = PRISMA_DB_URL // Hot glue and duct tape
const prismaMigrateType = isDevelopment ? 'dev' : 'deploy'

// Initialize Prisma
let prismaInitPromise = null
prismaInitPromise = runPrismaCommand(['migrate', prismaMigrateType], PRISMA_DB_URL)
prismaInitPromise.catch((e) => {
    console.error(e)
    app.quit()
    win = null
})

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

// Global variables
let win // BrowserWindow | null
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

async function createWindow() {
    await prismaInitPromise
    const { width, height } = screen.getPrimaryDisplay().size

    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC, 'logo.png'),
        width: Math.floor(width * 0.75),
        height: Math.floor(height * 0.75),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })
    win.setMenuBarVisibility(false)
    win.setResizable(false)
    // https://stackoverflow.com/a/67108615
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url)
        return { action: 'deny' }
    })

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', async () => {
        console.log('Webcontents finished loading')

        const scaleFactor = screen.getPrimaryDisplay().scaleFactor
        win.webContents.setZoomFactor(scaleFactor)

        let credentialsExist = fs.existsSync(PRISMA_ENCRYPTED_CREDENTIALS_PATH)
        win?.webContents.send('event:initialSetup', !credentialsExist)

        if (isDevelopment) {
            console.log('opening devtools')
            win?.webContents.openDevTools()
        }
    })

    // Emitted when the window is closed.
    win.on('closed', function () {
        // Dereference the window object
        win = null
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(process.env.DIST, 'index.html'))
    }
}

// Disable reload | https://stackoverflow.com/a/63241601
app.on('browser-window-focus', function () {
    globalShortcut.register("CommandOrControl+R", () => {
        console.log("CommandOrControl+R is pressed: Shortcut Disabled")
    })
    globalShortcut.register("F5", () => {
        console.log("F5 is pressed: Shortcut Disabled")
    })
})
app.on('browser-window-blur', function () {
    globalShortcut.unregister('CommandOrControl+R')
    globalShortcut.unregister('F5')
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.on('ready', async () => {
    await createWindow()
    setIpcRoutes(win)
})