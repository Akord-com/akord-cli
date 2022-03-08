const AccessKeyEncrypter = require('./access-key-encrypter');
const KeysStructureEncrypter = require('./keys-structure-encrypter');

/**
 * ts TODO: move to singleton
 */
module.exports = (function () {
  class EncrypterFactory {

    constructor(wallet, encryptionKeys) {
      switch (encryptionKeys?.encryptionType) {
        case 'ACCESS_KEY':
          this.encrypter = new AccessKeyEncrypter(wallet, encryptionKeys?.encAccessKey)
          break
        case 'KEYS_STRUCTURE':
          this.encrypter = new KeysStructureEncrypter(wallet, encryptionKeys?.keys,
            encryptionKeys?.getPublicKey())
          break
        default: // for testing
          this.encrypter = new KeysStructureEncrypter(wallet, encryptionKeys?.keys,
            encryptionKeys?.getPublicKey())
      }
    }

    encrypterInstance() {
      return this.encrypter
    }
  }
  return EncrypterFactory
})();
