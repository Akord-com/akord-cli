const cryptoHelper = require('../crypto-helpers');
const { arrayToBase64, base64ToArray, arrayToString, base64ToJson } = require('../encoding-helpers');
const mnemonicKeys = require('arweave-mnemonic-keys');
const bip39 = require('bip39');
const constants = require('../constants');
const hdkey = require('hdkey');
const _sodium = require('libsodium-wrappers');
const nacl = require('tweetnacl')
const users = require("../../users.json");

module.exports = (function () {
  class MnemonicWallet {
    constructor(mnemonic, jwk) {
      this.backupPhrase = mnemonic
      this.keyPair = {}
      this.signingKeyPair = {}
      this.wallet = jwk
    }

    static async create() {
      const mnemonic = await mnemonicKeys.generateMnemonic();
      const jwk = await mnemonicKeys.getKeyFromMnemonic(mnemonic.toString());
      const wallet = new MnemonicWallet(mnemonic, jwk);
      await wallet.deriveKeys()
      return wallet
    }

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
      const wallet = new MnemonicWallet(backupPhrase);
      await wallet.deriveKeys();
      await wallet.deriveJWK();
      return wallet
    }

    static async recover(mnemonic, jwk) {
      const wallet = new MnemonicWallet(mnemonic, jwk);
      await wallet.deriveKeys();
      if (!this.wallet)
        await wallet.deriveJWK();
      return wallet;
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

    async deriveJWK() {
      const jwk = await mnemonicKeys.getKeyFromMnemonic(this.backupPhrase.toString());
      this.wallet = jwk
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

    async encrypt(input) {
      return cryptoHelper.encryptRawWithPublicKey(this.publicKeyRaw(), input)
    }

    async decrypt(input) {
      return cryptoHelper.decryptRawWithPrivateKey(
        this.privateKeyRaw(),
        input)
    }

    async encryptToPublicKey(input, publicKey) {
      return cryptoHelper.encryptRawWithPublicKey(publicKey, input)
    }

    async sign(string) {
      return await cryptoHelper.signString(string, this.signingPrivateKeyRaw());
    }

    async getAddress() {
      return cryptoHelper.deriveAddress(this.signingPublicKeyRaw(), "akord");
    }

    async getPublicKeyFromAddress(address) {
      // TODO: call Akord API here
      let publicKey;
      Object.keys(users).map(function (key, index) {
        if (key === address) publicKey = users[key].publicKey
      });
      return base64ToArray(publicKey);
    }
  }

  async function decryptWithPassword(password, strPayload) {
    try {
      const parsedPayload = base64ToJson(strPayload)

      const encryptedPayload = parsedPayload.encryptedPayload
      const salt = base64ToArray(parsedPayload.salt)

      const derivedKey = await cryptoHelper.deriveKey(password, salt)

      const plaintext = await cryptoHelper.decrypt(encryptedPayload, derivedKey)
      return arrayToString(plaintext)
    } catch (err) {
      throw new Error('Wallet error: decrypt with password: ' + err)
    }
  }

  return MnemonicWallet;
})();