const cryptoHelper = require('../crypto-helpers');
const Encrypter = require('./encrypter');
const { base64ToJson, base64ToArray } = require('../encoding-helpers');

/**
 * Arweave wallet de-/encryption specific methods
 */
module.exports = (function () {
  class ArEncrypter extends Encrypter {
    constructor(wallet, keys, publicKey) {
      super(publicKey)
      this.wallet = wallet
      this.keys = keys
      this.decryptedKeys = []
    }

    async _decryptKeys() {
      if (this.keys && (!this.decryptedKeys || this.decryptedKeys.length < this.keys.length)) {
        try {
          for (let x = this.decryptedKeys.length; x < this.keys.length; x++) {
            const key = this.keys[x];
            const privateKey = await cryptoHelper.decryptWithArweaveWallet(
              key.encPrivateKey
            )
            this.decryptedKeys.push({
              publicKey: key.publicKey,
              privateKey: base64ToArray(privateKey)
            })
          }
        } catch (error) {
          console.log(error)
          throw new Error(error)
        }
      }
    }

    async encryptMemberKeys(memberKeys) {
      let keys = []
      await this._decryptKeys()
      for (let x = memberKeys.length; x < this.decryptedKeys.length; x++) {
        // encrypt private key for member's wallet address
        const encPrivateKey = await cryptoHelper.encryptRawForArweavePublicKey(
          this.publicKey,
          this.decryptedKeys[x].privateKey
        )
        keys.push({
          publicKey: this.decryptedKeys[x].publicKey,
          encPrivateKey: encPrivateKey
        })
      }
      return keys
    }

    async encryptMemberKey(privateKey) {
      await this._decryptKeys()
      // encrypt private key for member's wallet address
      const encPrivateKey = await cryptoHelper.encryptRawForArweavePublicKey(
        this.publicKey,
        privateKey
      )
      return encPrivateKey
    }

    async decryptRaw(encryptedPayload, decode = true) {
      if (encryptedPayload === null) return null
      try {
        await this._decryptKeys()
        const payload = decode ? base64ToJson(encryptedPayload) : encryptedPayload
        const key = this.decryptedKeys.filter(
          key => key.publicKey === payload.publicKey
        )
        if (key.length === 0) {
          throw new Error('The user does not have a correct key to decrypt the data.')
        }
        return cryptoHelper.decryptHybridRaw(encryptedPayload, key[0].privateKey, decode)
      } catch (error) {
        console.log(error)
      }
    }

    async encryptRaw(plaintext, encode = true) {
      return cryptoHelper.encryptHybridRaw(plaintext, this.publicKey, encode)
    }
  }
  return ArEncrypter;
})();
