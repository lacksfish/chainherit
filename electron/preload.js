import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
    getRecipients: () => ipcRenderer.invoke('recipients:get'),
    postRecipient: (recipient) => ipcRenderer.invoke('recipients:post', recipient),
    putRecipient: (recipient) => ipcRenderer.invoke('recipients:put', recipient),
    deleteRecipient: (recipient) => ipcRenderer.invoke('recipients:delete', recipient),
    getWallets: () => ipcRenderer.invoke('wallets:get'),
    deleteWallet: (wallet) => ipcRenderer.invoke('wallets:delete', wallet),
    postPublicKey: (publicKey) => ipcRenderer.invoke('publicKey:post', publicKey),
    getDistributions: () => ipcRenderer.invoke('distributions:get'),
    postDistribution: (distribution) => ipcRenderer.invoke('distributions:post', distribution),
    deleteDistribution: (distribution) => ipcRenderer.invoke('distributions:delete', distribution),
    postGenTx: (genTx) => ipcRenderer.invoke('genTx:post', genTx),
    postSignTx: (signTx) => ipcRenderer.invoke('signTx:post', signTx),

    getTxInfo: (txInfo) => ipcRenderer.invoke('txInfo:get', txInfo),
    selectNode: (node) => ipcRenderer.invoke('node:select', node),
    connectNode: () => ipcRenderer.invoke('node:connect'),
    getSettings: () => ipcRenderer.invoke('settings:get'),

    postPassword: (password) => ipcRenderer.invoke('password:post', password),
    getNetwork: () => ipcRenderer.invoke('network:get'),

    resubscribeAddresses: () => ipcRenderer.invoke('resubscribe:addresses'),

    // From main to render.
    on: (channel, fn) => {
        ipcRenderer.on(channel, (event, ...args) => fn(...args))
    }
})