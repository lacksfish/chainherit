import * as bitcoin from 'bitcoinjs-lib'

export function getNetwork() {
    return process.env.NETWORK === 'TBTC' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin
}

export function getNetworkStr() {
    return process.env.NETWORK === 'TBTC' ? 'testnet' : 'mainnet'
}

export function isTestnet() {
    return process.env.NETWORK === 'TBTC'
}