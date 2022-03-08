const { arweave, getPublicKeyFromAddress } = require('../../arweave-helpers');
const cryptoHelper = require('../crypto-helpers');
const { stringToArray, arrayToBase64, base64ToArray } = require('../encoding-helpers');
const nodeCrypto = require('crypto');
const crypto = nodeCrypto.webcrypto;

module.exports = (function () {
  class ArweaveWallet {
    constructor(jwk) {
      if (jwk) {
        this.walletType = "JWK"
        this.wallet = jwk
      } else {
        this.walletType = "ARCONNECT"
        this.wallet = window.arweaveWallet
      }
    }

    async encrypt(stringToEncrypt) {
      const string = arrayToBase64(stringToEncrypt);
      const array = new Uint8Array(256);
      const keyBuf = crypto.getRandomValues(array);
      const encryptedData = await arweave.crypto.encrypt(stringToArray(string), keyBuf);
      const address = await arweave.wallets.jwkToAddress(
        this.walletType === "JWK"
          ? this.wallet
          : "use-wallet"
      );
      const publicKey = await getPublicKeyFromAddress(address);
      const publicKeyJWK = await cryptoHelper.importRSAPublicKey(publicKey);
      const encryptedKey = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKeyJWK,
        keyBuf
      );
      const buffer = arweave.utils.concatBuffers([encryptedKey, encryptedData]);
      return arrayToBase64(buffer);
    }

    async encryptToPublicKey(stringToEncrypt, publicKey) {
      const string = arrayToBase64(stringToEncrypt);
      const array = new Uint8Array(256);
      const keyBuf = crypto.getRandomValues(array);
      const encryptedData = await arweave.crypto.encrypt(stringToArray(string), keyBuf);
      const encryptedKey = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKey,
        keyBuf
      );
      const buffer = arweave.utils.concatBuffers([encryptedKey, encryptedData]);
      return arrayToBase64(buffer);
    }

    async decrypt(encryptedString) {
      const key = await cryptoHelper.importRSACryptoKey(this.wallet);
      const data = base64ToArray(encryptedString);
      const encryptedKey = new Uint8Array(
        new Uint8Array(Object.values(data)).slice(0, 512)
      )
      const encryptedData = new Uint8Array(
        new Uint8Array(Object.values(data)).slice(512)
      );

      const symmetricKey = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        key,
        encryptedKey
      );

      const res = await arweave.crypto.decrypt(
        encryptedData,
        new Uint8Array(symmetricKey)
      );
      return base64ToArray(arweave.utils.bufferToString(res).split()[0]);
    }

    async sign(dataArray) {
      const signatureOptions = {
        name: "RSA-PSS",
        saltLength: 32,
      }
      let rawSignature;
      if (this.walletType === "JWK") {
        rawSignature = await arweave.crypto.sign(
          this.wallet,
          dataArray
        );
      } else {
        rawSignature = await this.wallet.signature(
          dataArray, signatureOptions);
      }
      const signature = arweave.utils.bufferTob64(rawSignature);
      // const signature = arrayToBase64(Uint8Array.from(Object.values(rawSignature)));
      return signature;
    }

    async getPublicKey() {
      if (this.walletType === "JWK") {
        return this.wallet.n
      } else {
        const address = await arweave.wallets.jwkToAddress(
          this.walletType === "JWK"
            ? this.wallet
            : "use-wallet"
        );
        const publicKey = await getPublicKeyFromAddress(address);
        return publicKey;
      }
    }

    async getAddress() {
      const address = await arweave.wallets.jwkToAddress(
        this.walletType === "JWK"
          ? this.wallet
          : "use-wallet"
      );
      return address;
    }

    // async verifySignature(encryptedString) {
    //   const verified = await arweave.crypto.verify(
    //     publicKey,
    //     SmartWeave.arweave.utils.stringToBuffer(`${header}${body}`),
    //     SmartWeave.arweave.utils.b64UrlToBuffer(signature)
    //   );
    // return verified;
  }
  return ArweaveWallet;
})();