const constants = require('./constants');
const bip39 = require('bip39');
const hdkey = require('hdkey');
const { arrayToBase64 } = require('./encoding-helpers');
const _sodium = require('libsodium-wrappers');
const nacl = require('tweetnacl');

module.exports = (function () {
  class AkordWallet {
    constructor(backupPhrase, encBackupPhrase) {
      this.backupPhrase = backupPhrase
      this.encBackupPhrase = encBackupPhrase
      this.keyPair = {}
      this.signingKeyPair = {}
    }

    /**
     * Create the wallet
     * - generate 12 word backup phrase
     * - encrypt backup phrase with password derived symmetric key
     * - derive wallet keys from backup phrase
     * @param {string} password
     * @returns {Promise.<AkordWallet>} Promise of AkordWallet object
     */
    static async create(password) {
      if (!password)
        throw new Error('Akord Wallet error: The password cannot be null.')

      const backupPhrase = bip39.generateMnemonic()
      const encBackupPhrase = await encryptWithPassword(password, backupPhrase)
      const akordWallet = new AkordWallet(backupPhrase, encBackupPhrase)
      await akordWallet.deriveKeys()
      return akordWallet
    }

    /**
     * Import the wallet from the encrypted backup phrase
     * - decrypt the encrypted backup phrase with password derived symmetric key
     * - derive wallet keys from backup phrase
     * @param {string} password
     * @param {string} encBackupPhrase
     * @returns {Promise.<AkordWallet>} Promise of AkordWallet object
     */
    static async importFromEncBackupPhrase(password, encBackupPhrase) {
      if (!password)
        throw new Error('Akord Wallet error: The password cannot be null.')
      if (!encBackupPhrase)
        throw new Error(
          'Akord Wallet error: The encrypted backup phrase cannot be null.'
        )

      const backupPhrase = await decryptWithPassword(password, encBackupPhrase)
      if (!this.isValidMnemonic(backupPhrase))
        throw new Error('Akord Wallet error: Invalid backup phrase.')
      const akordWallet = new AkordWallet(backupPhrase, encBackupPhrase)
      await akordWallet.deriveKeys()
      return akordWallet
    }

    // /**
    //  * Import the wallet from the keystore
    //  * - retrieve the password derived symmetric key from the keystore
    //  * - retrieve the encrypted backup phrase from the local storage
    //  * -
    //  * @param {string} encBackupPhrase
    //  * @returns {Promise.<AkordWallet>} Promise of AkordWallet object
    //  */
    // static async importFromKeystore(encBackupPhrase) {
    //   if (!encBackupPhrase)
    //     throw new Error(
    //       'Akord Wallet error: The encrypted backup phrase cannot be null.'
    //     )
    //   const passwordKey = await getKey('passwordKey')
    //   if (!passwordKey)
    //     throw new Error('Akord Wallet error: The password key cannot be null.')

    //   const parsedEncBackupPhrase = base64ToJson(encBackupPhrase)
    //   const plaintext = await decrypt(
    //     parsedEncBackupPhrase.encryptedPayload,
    //     passwordKey
    //   )
    //   const backupPhrase = arrayToString(plaintext)
    //   if (!this.isValidMnemonic(backupPhrase))
    //     throw new Error('Akord Wallet error: Invalid backup phrase.')

    //   const akordWallet = new AkordWallet(backupPhrase, encBackupPhrase)
    //   await akordWallet.deriveKeys()
    //   return akordWallet
    // }

    /**
     * Import the wallet from the backup phrase
     * - encrypt backup phrase with new password derived symmetric key
     * - derive wallet keys from backup phrase
     * @param {string} newPassword
     * @param {string} backupPhrase
     * @returns {Promise.<AkordWallet>} Promise of AkordWallet object
     */
    static async recover(newPassword, backupPhrase) {
      if (!this.isValidMnemonic(backupPhrase))
        throw new Error('Akord Wallet error: Invalid backup phrase.')
      const encBackupPhrase = await encryptWithPassword(newPassword, backupPhrase)
      const akordWallet = new AkordWallet(backupPhrase, encBackupPhrase)
      await akordWallet.deriveKeys()
      return akordWallet
    }

    static async changePassword(oldPassword, newPassword, encBackupPhrase) {
      // decrypt backup phrase with the old password
      const backupPhrase = await decryptWithPassword(oldPassword, encBackupPhrase)
      if (!this.isValidMnemonic(backupPhrase))
        throw new Error('Akord Wallet error: Invalid backup phrase.')
      // encrypt backup phrase with the new password
      const newEncBackupPhrase = await encryptWithPassword(
        newPassword,
        backupPhrase
      )
      const akordWallet = new AkordWallet(backupPhrase, newEncBackupPhrase)
      await akordWallet.deriveKeys()
      return akordWallet
    }

    static async clear() {
      // await deleteKey('passwordKey')
    }

    static isValidMnemonic(backupPhrase) {
      return bip39.validateMnemonic(backupPhrase)
    }

    /**
     * Root node derivation from backup phrase
     * - derives the master seed from the backup phrase
     * - derives the root node from the master seed
     * @param {string} backupPhrase
     * @returns {Promise.<hdkey>} Promise of hdkey object with HD wallet root node
     */
    async getRoot() {
      const seed = await bip39.mnemonicToSeed(this.backupPhrase)
      return hdkey.fromMasterSeed(seed)
    }

    /**
     * Node derivation from backup phrase and given path
     * @param {string} path
     * @returns {Promise.<hdkey>} Promise of hdkey object with HD wallet node
     */
    async getNodeFromPath(path) {
      const root = await this.getRoot(this.backupPhrase)
      return root.derive(path)
    }

    /**
     * Public key derivation for the given path
     * @param {string} path
     * @returns {Promise.<string>} Promise of base64 string represents public key
     */
    async getPublicKeyFromPath(path) {
      const keyPair = await this.getKeyPairFromPath(path)
      return keyPair.publicKey
    }

    /**
     * Private key derivation for the given path
     * @param {string} path
     * @returns {Promise.<string>} Promise of base64 string represents private key
     */
    async getPrivateKeyFromPath(path) {
      const keyPair = await this.getKeyPairFromPath(path)
      return keyPair.privateKey
    }

    /**
     * Key pair derivation for the given path
     * @param {string} path
     * @returns {Promise.<{ publicKey: string, privateKey: string }>} Promise of JSON represents key pair
     */
    async getKeyPairFromPath(path) {
      const node = await this.getNodeFromPath(path)
      await _sodium.ready
      const sodium = _sodium
      if (path === constants.HD_ENCRYPTION_PATH) {
        const encryptionKeyPair = nacl.box.keyPair.fromSecretKey(node._privateKey)
        return {
          publicKey: arrayToBase64(encryptionKeyPair.publicKey),
          privateKey: arrayToBase64(encryptionKeyPair.secretKey)
        }
      }
      const signingKeyPair = sodium.crypto_sign_seed_keypair(node._privateKey)
      return {
        publicKey: arrayToBase64(signingKeyPair.publicKey),
        privateKey: arrayToBase64(signingKeyPair.privateKey)
      }
    }

    /**
     * Derive encryption and signing key pair for the wallet
     */
    async deriveKeys() {
      const node = await this.getNodeFromPath(constants.HD_ENCRYPTION_PATH)
      const signingNode = await this.getNodeFromPath(constants.HD_SIGNING_PATH)
      await _sodium.ready
      const sodium = _sodium
      const encryptionKeyPair = nacl.box.keyPair.fromSecretKey(node._privateKey)
      const signingKeyPair = sodium.crypto_sign_seed_keypair(signingNode._privateKey)
      this.keyPair.privateKey = encryptionKeyPair.secretKey
      this.keyPair.publicKey = encryptionKeyPair.publicKey
      this.signingKeyPair.privateKey = signingKeyPair.privateKey
      this.signingKeyPair.publicKey = signingKeyPair.publicKey
    }

    /**
     * Encryption private key
     * @returns {Uint8Array}
     */
    privateKeyRaw() {
      return this.keyPair.privateKey
    }

    /**
     * Encryption public key
     * @returns {Uint8Array}
     */
    publicKeyRaw() {
      return this.keyPair.publicKey
    }

    /**
     * Encryption private key as a string
     * @returns {string}
     */
    privateKey() {
      return arrayToBase64(this.keyPair.privateKey)
    }

    /**
     * Encryption public key as a string
     * @returns {string}
     */
    publicKey() {
      return arrayToBase64(this.keyPair.publicKey)
    }

    /**
     * Signing private key
     * @returns {Uint8Array}
     */
    signingPrivateKeyRaw() {
      return this.signingKeyPair.privateKey
    }

    /**
     * Signing public key
     * @returns {Uint8Array}
     */
    signingPublicKeyRaw() {
      return this.signingKeyPair.publicKey
    }

    /**
     * Signing private key as a string
     * @returns {string}
     */
    signingPrivateKey() {
      return arrayToBase64(this.signingKeyPair.privateKey)
    }

    /**
     * Signing public key as a string
     * @returns {string}
     */
    signingPublicKey() {
      return arrayToBase64(this.signingKeyPair.publicKey)
    }
  }

  /**
   * Encryption with key derived from password
   * - generate random salt
   * - derive the encryption key from password and salt
   * - encrypt plaintext with the derived key
   * @param {string} password
   * @param {string} plaintext utf-8 string plaintext
   * @returns {Promise.<string>} Promise of string represents stringified payload
   */
  async function encryptWithPassword(password, plaintext) {
    // try {
    //   const salt = window.crypto.getRandomValues(
    //     new Uint8Array(constants.SALT_LENGTH)
    //   )
    //   const derivedKey = await deriveKey(password, salt)

    //   await storeKey('passwordKey', derivedKey)

    //   const encryptedPayload = await encrypt(
    //     stringToArray(plaintext),
    //     derivedKey
    //   )

    //   const payload = {
    //     encryptedPayload: encryptedPayload,
    //     salt: arrayToBase64(salt)
    //   }
    //   return jsonToBase64(payload)
    // } catch (err) {
    //   throw new Error('Akord Wallet error: encrypt with password: ' + err)
    // }
  }

  /**
   * Decryption with key derived from password
   * - parse the payload
   * - derive the decryption key from password and salt
   * - decrypt the ciphertext with the derived key
   * @param {string} password
   * @param {string} strPayload stringified payload
   * @returns {Promise.<string>} Promise of string represents utf-8 plaintext
   */
  async function decryptWithPassword(password, strPayload) {
    // try {
    //   const parsedPayload = base64ToJson(strPayload)

    //   const encryptedPayload = parsedPayload.encryptedPayload
    //   const salt = base64ToArray(parsedPayload.salt)

    //   const derivedKey = await deriveKey(password, salt)
    //   // await storeKey('passwordKey', derivedKey)

    //   const plaintext = await decrypt(encryptedPayload, derivedKey)
    //   return arrayToString(plaintext)
    // } catch (err) {
    //   throw new Error('Akord Wallet error: decrypt with password: ' + err)
    // }
  }
  return AkordWallet;
})();