import net from 'net'
import tls from 'tls'
import ElectrumClient from 'electrum-client'
import { addressToScriptHash } from './../utils/crypto'

class ElectrumConnection extends EventTarget {
    client
    id
    network
    url
    port
    keepAlive
    persistencePolicy
    reconnectTimeout

    constructor() {
        // return always the same instance
        if (ElectrumConnection._instance) {
            return ElectrumConnection._instance
        }
        super()
        ElectrumConnection._instance = this
    }

    // add initialize function which has the params of the constructor
    init(url, port, network, type = 'tcp', persistencePolicy = { maxRetry: 0, callback: () => { console.log('persistence callback') } }) {
        this.network = network
        this.url = url
        this.port = port
        this.type = type
        this.persistencePolicy = persistencePolicy
        this.reconnectTimeout = null
    }

    destroy() {
        ElectrumConnection._instance = null
    }

    async reconnect() {
        let self = this
        // if (this.reconnectTimeout || (this.client && this.client.status == 1)) {
        if (this.reconnectTimeout) {
            return
        }

        try {
            await this.client.reconnect()
            this.dispatchEvent(new Event('reconnectEvent'))
        } catch (err) {
            console.log('ElectrumClient reconnect failed: Retrying in 5s')
            clearTimeout(this.reconnectTimeout)
            self.reconnectTimeout = setTimeout(async () => {
                self.reconnectTimeout = null
                await self.reconnect()
            }, 5000)
        }
    }

    connect(onConnectCallback, onDisonnectCallback) {
        //check if this.client is connected, is the socket active and alive? do not use this.client.status, it doesnt seem reliable
        if (this.client && this.client.status == 1) {
            console.log('ElectrumClient already connected')
            return Promise.resolve()
        }

        this.client = new ElectrumClient(net, tls, this.port, this.url, this.type)

        this.client.onError = async (err) => {
            this.client.status = 0
            if (err.toString().indexOf('ECONNREFUSED') > -1) {
                console.log('ElectrumClient error: Connection refused')
            } else if (err.toString().indexOf('keepalive ping timeout') > -1) {
                // Do nothing
            } else {
                console.log('ElectrumClient error', err)
            }
        }
        this.client.onClose = async () => {
            this.client.status = 0
            console.log('ElectrumClient closed')
            if (typeof onDisonnectCallback === 'function') { onDisonnectCallback() }
        }
        this.client.onConnect = () => {
            console.log('ElectrumClient connected')
            if (typeof onConnectCallback === 'function') { onConnectCallback() }
        }

        return this.client.initElectrum({ client: 'chainherit', version: '1.4' }, { maxRetry: 10, callback: null })
    }

    async addressListUnspent(address) {
        const response = await this.client.blockchainScripthash_listunspent(addressToScriptHash(address, this.network))
        return response
    }

    async addressGetHistory(address) {
        const response = await this.client.blockchainScripthash_getHistory(addressToScriptHash(address, this.network))
        return response
    }

    async transactionGet(txid) {
        const response = await this.client.blockchainTransaction_get(txid)
        return response
    }
}

export default ElectrumConnection