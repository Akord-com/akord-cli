const cryptoHelper = require('../crypto-helpers');
const Encrypter = require('./encrypter');
/**
 * Access key de-/encryption specific methods
 */
module.exports = (function () {
  class AccessKeyEncrypter extends Encrypter {

    constructor(wallet, encAccessKey, publicKey) {
      super(publicKey)
      this.wallet = wallet
      this.encAccessKey = encAccessKey
      this.accessKey = null
    }

    async encryptRaw(plaintext) {
      await this._decryptAccessKey()
      return cryptoHelper.encrypt(plaintext, this.accessKey)
    }

    async decryptRaw(encryptedPayload, decode = true) {
      await this._decryptAccessKey()
      return cryptoHelper.decrypt(encryptedPayload, this.accessKey, decode)
    }

    async encryptMemberKeys() {
      await this._decryptAccessKey()
      const keyString = await cryptoHelper.exportKeyToBase64(this.accessKey)
      const encryptedKey = await cryptoHelper.encryptStringWithPublicKey(
        this.publicKey,
        keyString
      )
      return encryptedKey
    }

    // private

    async _decryptAccessKey() {
      if (!this.accessKey)
        this.accessKey = await this._decryptKeyWithWallet(this.encAccessKey)
    }

    /**
     * CryptoKey object decryption
     * - decrypts encoded key string wtih the wallet's private key
     * - import CryptoKey object from the encoded string
     * @returns {Promise.<CryptoKey>}
     */
    async _decryptKeyWithWallet() {
      const decryptedKey = await cryptoHelper.decryptStringWithPrivateKey(
        this.wallet.privateKeyRaw(),
        this.encAccessKey
      )
      const key = await cryptoHelper.importKeyFromBase64(decryptedKey)
      return key
    }

    /**
    * CryptoKey object encryption
    * - export CryptoKey object to base64 encoded string
    * - encrypts encoded key string with the wallet's public key
    * @param {CryptoKey} key
    * @returns {Promise.<string>}
    */
    async _encryptKeyWithWallet(key) {
      const keyString = await cryptoHelper.exportKeyToBase64(key)
      return cryptoHelper.encryptStringWithPublicKey(
        this.wallet.publicKeyRaw(),
        keyString
      )
    }
  }
  return AccessKeyEncrypter;
})();
