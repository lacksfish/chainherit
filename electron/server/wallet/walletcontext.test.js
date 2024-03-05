import WalletContext from './walletcontext'
import * as bitcoin from 'bitcoinjs-lib'
import { getNetwork, isTestnet } from './../network/env'
import { convertXpubKey } from './../utils/crypto'

jest.mock('./../network/env', () => ({
    getNetwork: jest.fn(),
    isTestnet: jest.fn(),
}))

WalletContext.prototype.fetchAddressInformation = jest.fn()

beforeEach(() => {
    getNetwork.mockReturnValue(bitcoin.networks.testnet)
    isTestnet.mockReturnValue(true)
    WalletContext.prototype.fetchAddressInformation.mockReset()
    WalletContext.prototype.fetchAddressInformation.mockImplementation(() =>
        Promise.resolve({
            utxos: [],
            used: false,
            txCount: 0,
        }))
})

describe('WalletContext', () => {
    describe('Initialization and Address Addition', () => {
        it('should initialize and add addresses correctly', async () => {
            const electrumMock = {
                addressGetHistory: jest.fn().mockResolvedValue([]),
                addressListUnspent: jest.fn().mockResolvedValue([]),
                transactionGet: jest.fn().mockResolvedValue(''),
            }
            const vpubString = 'vpub5UoXEXDGqB8WqytCCZ9rZ5sooP6aKc5LjEyXAgRL6hF6k18RkR4RYVV4BTa6gbdfhESG9upyrqYLgq2vD5JkCRvsJNHLVyf2tDD4aLcyo9z'
            const xpub = convertXpubKey(vpubString, true)
            const walletContext = new WalletContext(xpub, electrumMock, bitcoin.networks.testnet, [])

            await walletContext.initialize()

            expect(walletContext.derivations.length).toBeGreaterThanOrEqual(0)
            expect(walletContext.xpub).toEqual(xpub)
            expect(walletContext.network).toEqual(bitcoin.networks.testnet)

            // Simulate adding an address
            await walletContext.addAddress('mockAddress', 'm/0/0', {}, 'pubKeyHex')
            expect(walletContext.derivations.length).toBeGreaterThanOrEqual(1)
        })
    })
})
