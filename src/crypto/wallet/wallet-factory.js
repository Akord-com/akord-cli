const ArweaveWallet = require('./arweave-wallet');

/**
 * ts TODO: move to singleton
 */
module.exports = (function () {
  class WalletFactory {

    constructor(walletType, jwk) {
      switch (walletType) {
        case 'ARWEAVE':
          this.wallet = new ArweaveWallet(jwk)
          break
        default:
          this.wallet = new ArweaveWallet(jwk)
      }
    }

    walletInstance() {
      return this.wallet
    }
  }
  return WalletFactory;
})();