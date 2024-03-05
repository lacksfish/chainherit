import Ajv from "ajv"
const ajv = new Ajv()
import ajvFormats from 'ajv-formats'
ajvFormats(ajv)

import { convertXpubKey } from './../utils/crypto'
import * as bitcoin from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { BIP32Factory } from 'bip32'
const bip32 = BIP32Factory(ecc)

import { getNetwork, isTestnet } from './../network/env'

// Custom format for hexadecimal strings
ajv.addFormat("hex", /^[0-9a-fA-F]+$/i)

ajv.addKeyword({
    keyword: 'zpub',
    schemaType: 'string',
    validate: function validateZpub(schema, data) {
        const NETWORK = getNetwork()
        const TESTNET = isTestnet()
        try {
            const xpub = convertXpubKey(data, TESTNET)
            bip32.fromBase58(xpub, NETWORK)
            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }
})

ajv.addKeyword({
    keyword: 'coinaddress',
    schemaType: 'string',
    validate: function validateCoinAddress(schema, data, parentSchema) {
        const NETWORK = getNetwork()
        try {
            bitcoin.address.toOutputScript(data, NETWORK)
            return true
        } catch (e) {
            return false
        }
    }
})

const addPublicKeySchema = {
    type: "object",
    properties: {
        publicKey: { type: "string", zpub: '' },
        publicKeyLabel: { type: "string", minLength: 1, maxLength: 32 },
    },
    required: ["publicKey", "publicKeyLabel"],
    additionalProperties: false
}

const deleteDistributionSchema = {
    type: "object",
    properties: {
        deleteLabel: { type: "string", minLength: 1 },
    },
    required: ["deleteLabel"],
    additionalProperties: false
}

const addDistributionSchema = {
    type: "object",
    properties: {
        label: { type: 'string', minLength: 1, maxLength: 32 },
        distribution: {
            type: "array",
            minItems: 1,
            items: {
                type: 'object',
                properties: {
                    address: { type: 'string', coinaddress: '' },
                    label: { type: 'string' },
                    percentage: { type: 'number' }
                }
            }
        }
    },
    required: ['distribution', 'label'],
    additionalProperties: false
}

const updateSettingsSchema = {
    type: "object",
    properties: {
        electrumNodeUrl: { type: "string", pattern: "^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$" },
        electrumNodePort: { type: "number", minimum: 1, maximum: 65535 }
    },
    required: ["electrumNodeUrl", "electrumNodePort"],
    additionalProperties: false
}

const addRecipientSchema = {
    type: "object",
    properties: {
        address: { type: "string", coinaddress: "" },
        label: { type: "string", maxLength: 32 }
    },
    required: ["address", "label"],
    additionalProperties: false
}

const updateRecipientSchema = {
    type: "object",
    properties: {
        address: { type: "string", coinaddress: "" },
        label: { type: "string", maxLength: 32 },
        oldAddress: { type: "string", coinaddress: "" },
        oldLabel: { type: "string", maxLength: 32 }
    },
    required: ["address", "label"],
    additionalProperties: false
}

const deleteRecipientSchema = {
    type: "object",
    properties: {
        address: { type: "string", coinaddress: "" },
        label: { type: "string", maxLength: 32 }
    },
    required: ["address", "label"],
    additionalProperties: false
}

const deleteWalletSchema = {
    type: "object",
    properties: {
        walletLabel: { type: "string" }
    },
    required: ['walletLabel'],
    additionalProperties: false
}

const generateTXSchema = {
    type: "object",
    properties: {
        walletLabel: { type: "string" },
        distLabel: { type: "string" },
        validityDate: { type: "string", format: "date-time" },
        txFee: { type: "number" },
    },
    required: ['walletLabel', 'distLabel', 'validityDate', 'txFee'],
    additionalProperties: false
}

const postTXSchema = {
    type: "object",
    properties: {
        walletLabel: { type: "string" },
        distLabel: { type: "string" },
        validityDate: { type: "string", format: "date-time" },
        unsignedTx: { type: "string", format: "hex" },
        signedTx: { type: "string", format: "hex" },
    },
    required: ['walletLabel', 'distLabel', 'validityDate', 'unsignedTx', 'signedTx'],
    additionalProperties: false
}

export default {
    addPublicKey: ajv.compile(addPublicKeySchema),
    deleteDistribution: ajv.compile(deleteDistributionSchema),
    addDistribution: ajv.compile(addDistributionSchema),
    updateSettings: ajv.compile(updateSettingsSchema),
    addRecipient: ajv.compile(addRecipientSchema),
    updateRecipient: ajv.compile(updateRecipientSchema),
    deleteRecipient: ajv.compile(deleteRecipientSchema),
    deleteWallet: ajv.compile(deleteWalletSchema),
    generateTX: ajv.compile(generateTXSchema),
    postTX: ajv.compile(postTXSchema),
}