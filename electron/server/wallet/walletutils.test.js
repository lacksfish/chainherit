import * as bitcointx from './walletutils'
import * as bitcoin from 'bitcoinjs-lib'
import WalletContext from '../wallet/walletcontext'
import ElectrumConnection from '../network/electrum'
import { getNetwork, isTestnet } from './../network/env'

jest.mock('./../network/env', () => ({
    getNetwork: jest.fn(),
    isTestnet: jest.fn(),
}))

jest.mock('../wallet/walletcontext')
jest.mock('../network/electrum')

beforeEach(() => {
    jest.clearAllMocks()

    getNetwork.mockReturnValue(bitcoin.networks.testnet)
    isTestnet.mockReturnValue(true)

    WalletContext.mockImplementation(() => ({
        initialize: jest.fn(() => Promise.resolve()),
        derivations: [],
    }))

    ElectrumConnection.mockImplementation(() => ({
        connect: jest.fn(() => Promise.resolve()),
    }))
})

describe('Bitcointx', () => {
    describe('generateAddresses', () => {
        it('should generate addresses based on the testnet network', async () => {
            const rootPubKey = 'vpub5UoXEXDGqB8WqytCCZ9rZ5sooP6aKc5LjEyXAgRL6hF6k18RkR4RYVV4BTa6gbdfhESG9upyrqYLgq2vD5JkCRvsJNHLVyf2tDD4aLcyo9z'

            const mockDerivation = {
                address: 'mtkbaiLiUH3fvGJeSzuN3kUgmJzqinLejJ',
                derivationPath: 'm/0/0',
                confirmedBalance: 100000,
                unconfirmedBalance: 0,
                totalBalance: 0,
                scriptHash: 'mockedScriptHash',
                pubkey: 'mockedPubKey',
                txCount: 0,
                utxos: [],
            }
            WalletContext.mockImplementation(() => ({
                initialize: jest.fn(() => Promise.resolve()),
                derivations: [mockDerivation],
            }))

            const addresses = await bitcointx.generateAddresses(rootPubKey)
            expect(addresses).toHaveLength(1)
            expect(addresses[0].address).toEqual(mockDerivation.address)
            expect(getNetwork).toHaveBeenCalled()
            expect(isTestnet).toHaveBeenCalled()
        })
    })

})
