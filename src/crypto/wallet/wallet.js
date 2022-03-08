/**
 * Abstract the wallet
 * ts TODO: move to abstract class with default implementations
 */
module.exports = (function () {
  class Wallet {
    async encrypt() {
      throw new Error('Abstract method encrypt needs to be implemented in the subclass');
    }

    async decrypt() {
      throw new Error('Abstract method decrypt needs to be implemented in the subclass');
    }

    async encryptToPublicKey() {
      throw new Error('Abstract method encryptForPublicKey needs to be implemented in the subclass');
    }
  }
  return Wallet;
})();