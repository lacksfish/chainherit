import b58 from 'bs58check'
import * as bitcoin from 'bitcoinjs-lib'

function convertXpubKey(z, testnet) {
    let data = b58.decode(z)
    data = data.slice(4)
    if (testnet == true) {
        // https://github.com/spesmilo/electrumx/blob/master/electrumx/lib/coins.py#L836
        data = Buffer.concat([Buffer.from('043587cf', 'hex'), data])
    } else {
        data = Buffer.concat([Buffer.from('0488b21e', 'hex'), data])
    }
    return b58.encode(data)
}

function addressToScriptHash(address, network) {
    const script = bitcoin.address.toOutputScript(address, network)
    const hash = bitcoin.crypto.sha256(script)
    const reversedScriptHash = (Buffer.from(hash.reverse())).toString('hex')
    return reversedScriptHash
}

function parseDerivationPath(path) {
    const [purpose, network, account, change, index] = path.split("/").map(segment => parseInt(segment.replace("'", "")))

    return {
        purpose,
        network,
        account,
        change,
        index
    }
}


export {
    convertXpubKey,
    addressToScriptHash,
    parseDerivationPath
}