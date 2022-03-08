const cryptoHelper = require('../crypto-helpers');
const Encrypter = require('./encrypter');
const { base64ToJson } = require('../encoding-helpers');

/**
 * Keys structure de-/encryption specific methods
 */
module.exports = (function () {
  class KeysStructureEncrypter extends Encrypter {
    constructor(wallet, keys, publicKey) {
      super(publicKey)
      this.wallet = wallet
      this.keys = keys
      this.decryptedKeys = []
    }

    async _decryptKeys() {
      if (this.keys && (!this.decryptedKeys || this.decryptedKeys.length < this.keys.length)) {
        try {
          const promises = this.keys.map(async key => {
            const privateKey = await this.wallet.decrypt(key.encPrivateKey)
            this.decryptedKeys.push({
              publicKey: key.publicKey,
              privateKey: privateKey
            })
          })
          await Promise.all(promises);
        } catch (error) {
          throw new Error(error)
        }
      }
    }

    async encryptMemberKeys(memberKeys) {
      let keys = []
      await this._decryptKeys()
      for (let x = memberKeys.length; x < this.decryptedKeys.length; x++) {
        // encrypt private key with member's wallet public key
        const encPrivateKey = await this.wallet.encryptToPublicKey(
          this.decryptedKeys[x].privateKey,
          this.publicKey
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
      const encPrivateKey = await this.wallet.encryptToPublicKey(
        privateKey,
        this.publicKey
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
          console.log('The user does not have a correct key to decrypt the data.')
          // throw new Error('The user does not have a correct key to decrypt the data.')
        }
        return cryptoHelper.decryptHybridRaw(encryptedPayload, key[0].privateKey, decode)
      } catch (error) {
        console.log(error)
        // throw new Error(error)
      }
    }

    async encryptRaw(plaintext, encode = true) {
      return cryptoHelper.encryptHybridRaw(plaintext, this.publicKey, encode)
    }
  }
  return KeysStructureEncrypter;
})();
