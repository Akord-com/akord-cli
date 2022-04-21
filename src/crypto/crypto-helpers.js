const _sodium = require('libsodium-wrappers');
const {
  SYMMETRIC_KEY_ALGORITHM,
  SYMMETRIC_KEY_LENGTH,
  ASYMMETRIC_PUBLIC_EXPONENT,
  ASYMMETRIC_KEY_ALGORITHM,
  HASH_ALGORITHM,
  IV_LENGTH,
  KEY_DERIVATION_FUNCTION,
  KEY_DERIVATION_ITERATION_COUNT
} = require('./constants');
const {
  arrayToBase64,
  arrayToString,
  base64ToArray,
  base64ToJson,
  jsonToBase64,
  stringToArray
} = require('./encoding-helpers');
const nodeCrypto = require('crypto');
const crypto = nodeCrypto.webcrypto;

/**
 * Export CryptoKey object to base64 encoded string
 * @param {CryptoKey} key
 * @returns {Promise.<string>} string containing crypto key
 */
async function exportKeyToBase64(key) {
  try {
    const rawKeyBuffer = await crypto.subtle.exportKey('raw', key)
    return arrayToBase64(rawKeyBuffer)
  } catch (error) {
    throw new Error("Web Crypto key export error: ", error)
  }
}

/**
 * Import CryptoKey object from base64 encoded string
 * @param {string} keyBase64
 * @returns {Promise.<CryptoKey>} crypto key object
 */
async function importKeyFromBase64(keyBase64) {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      base64ToArray(keyBase64),
      {
        name: SYMMETRIC_KEY_ALGORITHM,
        length: SYMMETRIC_KEY_LENGTH,
      },
      true,
      ['encrypt', 'decrypt'],
    )
    return key
  } catch (error) {
    throw new Error("Web Crypto key import error: ", error)
  }
}

/**
 * Import key from a random seed
 * @param {Uint8Array} key
 * @returns {Promise.<CryptoKey>} crypto key object
 */
async function importKeyFromSeed(seed) {
  try {
    const seedHash = await crypto.subtle.digest(HASH_ALGORITHM, seed)
    const key = await crypto.subtle.importKey(
      'raw',
      seedHash,
      {
        name: SYMMETRIC_KEY_ALGORITHM,
        length: SYMMETRIC_KEY_LENGTH,
      },
      false,
      ['encrypt', 'decrypt'],
    )
    return key
  } catch (error) {
    throw new Error("Web Crypto key import error: ", error)
  }
}

/**
 * Signature generation using sodium library: https://github.com/jedisct1/libsodium
 * @param {BufferSource} msgHash buffer message hash to be signed
 * @param {Uint8Array} privateKey private key used to sign message hash
 * @returns {Promise.<string>} signature as base64 string
 */
async function signHash(msgHash, privateKey) {
  const msgHashByteArray = Buffer.from(msgHash)
  await _sodium.ready
  const sodium = _sodium
  const signature = sodium.crypto_sign_detached(msgHashByteArray, privateKey)
  return arrayToBase64(signature)
}

/**
 * Digest generation
 * @param {string} payload string payload to be signed
 * @returns {Promise.<string>} payload digest as base64 string
 */
async function digest(payload) {
  return digestRaw(stringToArray(payload))
}

async function digestRaw(payload) {
  const msgHash = await crypto.subtle.digest(
    HASH_ALGORITHM,
    payload,
  )
  return arrayToBase64(msgHash)
}

/**
 * Signature generation
 * @param {string} payload string payload to be signed
 * @param {Uint8Array} privateKey private key used to sign string payload
 * @returns {Promise.<string>} signature as base64 string
 */
async function signString(payload, privateKey) {
  const msgHash = await crypto.subtle.digest(
    HASH_ALGORITHM,
    stringToArray(payload),
  )
  const signature = await signHash(msgHash, privateKey)
  return signature
}

async function verifyString(payload, publicKey, signature) {
  const msgHash = await crypto.subtle.digest(
    HASH_ALGORITHM,
    stringToArray(payload),
  )
  return verifyHash(msgHash, publicKey, signature);
}

async function verifyHash(msgHash, publicKey, signature) {
  const signatureByteArray = base64ToArray(signature);
  const msgHashByteArray = Buffer.from(msgHash);
  const publicKeyByteArray = base64ToArray(publicKey);

  await _sodium.ready;
  const sodium = _sodium;
  return sodium.crypto_sign_verify_detached(signatureByteArray, msgHashByteArray, publicKeyByteArray);
}

async function deriveAddress(publicKey, prefix) {
  // TODO: more research on the address derivation
  const sha256Digest = await crypto.subtle.digest(
    HASH_ALGORITHM,
    publicKey,
  );
  return arrayToBase64(sha256Digest);
}

/**
 * Encryption using WebCrypto
 * - generate a random initialization vector (iv)
 * - encrypt plaintext using key and iv
 * @param {Uint8Array} plaintext
 * @param {CryptoKey} key
 * @returns {Promise.<string>} Promise of base64 string represents the ciphertext along with iv
 */
async function encrypt(plaintext, key, encode = true) {
  try {
    const iv = nodeCrypto.randomBytes(IV_LENGTH);

    const ciphertextArray = await crypto.subtle.encrypt(
      {
        name: SYMMETRIC_KEY_ALGORITHM,
        iv: iv,
      },
      key,
      plaintext,
    )
    if (encode) {
      return encodePayload(ciphertextArray, iv)
    }
    return {
      ciphertext: ciphertextArray,
      iv: arrayToBase64(iv),
    }
  } catch (error) {
    throw new Error("Web Crypto encryption error: ", error)
  }
}

/**
 * Decryption using WebCrypto
 * - decrypt ciphertext using key and iv
 * @param {Object} encryptedPayload
 * @param {CryptoKey} key
 * @returns {Promise.<ArrayBuffer>} Promise of ArrayBuffer represents the plaintext
 */
async function decrypt(encryptedPayload, key, decode = true) {
  try {
    const payload = decode ? decodePayload(encryptedPayload) : encryptedPayload
    const plaintext = await crypto.subtle.decrypt(
      {
        name: SYMMETRIC_KEY_ALGORITHM,
        iv: payload.iv,
      },
      key,
      payload.ciphertext,
    )
    return plaintext
  } catch (error) {
    throw new Error("Web Crypto decryption error: ", error)
  }
}

function encodePayload(ciphertextArray, iv) {
  const encryptedPayload = {
    ciphertext: arrayToBase64(ciphertextArray),
    iv: arrayToBase64(iv),
  }
  return jsonToBase64(encryptedPayload)
}

function decodePayload(payload) {
  const parsedPayload = base64ToJson(payload)
  parsedPayload.ciphertext = base64ToArray(parsedPayload.ciphertext)
  parsedPayload.iv = base64ToArray(parsedPayload.iv)
  return parsedPayload
}

/**
 * Key derivation using WebCrypto
 * - PBKDF2 with 150000 iterations of SHA-256
 * @param {string} password
 * @param {BufferSource} salt
 * @returns {Promise.<CryptoKey>} Promise of CryptoKey object with AES 256-bit symmetric key
 */
async function deriveKey(password, salt) {
  try {
    const keyBase = await crypto.subtle.importKey(
      'raw',
      stringToArray(password),
      KEY_DERIVATION_FUNCTION,
      false,
      ['deriveBits', 'deriveKey'],
    )

    return crypto.subtle.deriveKey(
      {
        name: KEY_DERIVATION_FUNCTION,
        salt: salt,
        iterations: KEY_DERIVATION_ITERATION_COUNT,
        hash: HASH_ALGORITHM,
      },
      keyBase,
      {
        name: SYMMETRIC_KEY_ALGORITHM,
        length: SYMMETRIC_KEY_LENGTH,
      },
      false,
      ['encrypt', 'decrypt'],
    )
  } catch (error) {
    throw new Error("Web Crypto key derivation error: " + error)
  }
}

/**
 * Symmetric key generation
 * - generate an extractable AES 256-bit symmetric key
 * @returns {Promise.<CryptoKey>}
 */
async function generateKey() {
  try {
    const key = await crypto.subtle.generateKey(
      {
        name: SYMMETRIC_KEY_ALGORITHM,
        length: SYMMETRIC_KEY_LENGTH,
      },
      true,
      ['encrypt', 'decrypt'],
    )
    return key
  } catch (error) {
    throw new Error("Web Crypto key generation error: " + error)
  }
}

/**
 * Public key pair generation
 * - generate a Curve25519 key pair
 * @returns {Promise.<_sodium.KeyPair>}
 */
async function generateKeyPair() {
  try {
    await _sodium.ready;
    const sodium = _sodium;
    const keyPair = sodium.crypto_box_keypair()

    return keyPair
  } catch (error) {
    throw new Error("Sodium box key pair generation error: " + error)
  }
}

/**
 * Encryption using sodium library: https://github.com/jedisct1/libsodium
 * @param {Uint8Array} publicKey public key used to encrypt the data
 * @param {Uint8Array} plaintext raw plaintext byte array
 * @returns {Promise.<string>} Promise of base64 string represents the encrypted payload
 */
async function encryptRawWithPublicKey(publicKey, plaintext) {
  try {
    await _sodium.ready;
    const sodium = _sodium;
    const ephemeralKeyPair = sodium.crypto_box_keypair()
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)

    const ciphertext = sodium.crypto_box_easy(
      plaintext,
      nonce,
      publicKey,
      ephemeralKeyPair.privateKey,
    )

    const payload = {
      ciphertext: arrayToBase64(ciphertext),
      ephemPublicKey: arrayToBase64(ephemeralKeyPair.publicKey),
      nonce: arrayToBase64(nonce),
    }
    return jsonToBase64(payload)
  } catch (error) {
    throw new Error("Sodium encryption error: " + error)
  }
}

const importRSAPublicKey = async (publicKey) => {
  if (publicKey) {
    return await crypto.subtle.importKey(
      "jwk",
      {
        kty: 'RSA',
        e: ASYMMETRIC_PUBLIC_EXPONENT,
        n: publicKey,
        alg: 'RSA-OAEP-256',
        ext: true
      },
      {
        name: ASYMMETRIC_KEY_ALGORITHM,
        hash: {
          name: HASH_ALGORITHM
        },
      },
      false,
      ['encrypt']
    );
  } else {
    return null
  }
}

const importRSACryptoKey = async (jwk) => {
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: ASYMMETRIC_KEY_ALGORITHM,
      hash: {
        name: HASH_ALGORITHM
      },
    },
    false,
    ["decrypt"]
  );
}

/**
 * Decryption using sodium library: https://github.com/jedisct1/libsodium
 * @param {Uint8Array} privateKey private key used to decrypt the data
 * @param {string} encryptedPayload base64 string represents the encrypted payload
 * @returns {Promise.<Uint8Array>} Promise of raw plaintext byte array
 */
async function decryptRawWithPrivateKey(privateKey, encryptedPayload) {
  try {
    const parsedPayload = base64ToJson(encryptedPayload)

    const nonce = base64ToArray(parsedPayload.nonce)
    const ciphertext = base64ToArray(parsedPayload.ciphertext)
    const ephemPublicKey = base64ToArray(parsedPayload.ephemPublicKey)

    await _sodium.ready;
    const sodium = _sodium;

    const plaintext = sodium.crypto_box_open_easy(
      ciphertext,
      nonce,
      ephemPublicKey,
      privateKey,
    )
    return plaintext
  } catch (error) {
    throw new Error("Sodium decryption error: " + error)
  }
}

async function encryptStringWithPublicKey(publicKey, plaintext) {
  const ciphertext = await encryptRawWithPublicKey(publicKey, stringToArray(plaintext))
  return ciphertext
}

async function decryptStringWithPrivateKey(privateKey, encryptedPayload) {
  const plaintext = await decryptRawWithPrivateKey(privateKey, encryptedPayload)
  return arrayToString(plaintext)
}

/**
   * CryptoKey object encryption
   * - export CryptoKey object to base64 encoded string
   * - encrypts encoded key string with the given public key
   * @param {CryptoKey} key
   * @param {Uint8Array} publicKey
   * @returns {Promise.<string>}
   */
async function encryptKeyWithPublicKey(key, publicKey) {
  const keyString = await exportKeyToBase64(key)
  const encryptedKey = await encryptStringWithPublicKey(
    publicKey,
    keyString
  )
  return encryptedKey
}

/**
 * CryptoKey object decryption
 * - decrypts encoded key string with the given private key
 * - import CryptoKey object from the encoded string
 * @param {string} encryptedKey
 * @param {Uint8Array} privateKey
 * @returns {Promise.<CryptoKey>}
 */
async function decryptKeyWithPrivateKey(encryptedKey, privateKey) {
  const decryptedKey = await decryptStringWithPrivateKey(privateKey, encryptedKey)
  const key = await importKeyFromBase64(decryptedKey)
  return key
}

/**
 * Hybrid encryption
 * - generate a symmetric access key
 * - encrypt data with the access key
 * - encrypt the access key with the public key
 * @param {Uint8Array} privateKey private key used to decrypt the data
 * @param {string} encryptedPayload base64 string represents the encrypted payload
 * @returns {Promise.<Uint8Array>} Promise of raw plaintext byte array
 */
async function encryptHybridRaw(plaintext, publicKey, encode = true) {
  const accessKey = await generateKey()

  const encryptedData = await encrypt(
    plaintext,
    accessKey,
    encode
  )

  const encAccessKey = await encryptKeyWithPublicKey(
    accessKey,
    publicKey
  )

  const encryptedPayload = {
    encryptedData: encryptedData,
    encryptedKey: encAccessKey,
    // publicKey: arrayToBase64(publicKey) TODO: use vault public address or public key id
  }
  if (encode) {
    return jsonToBase64(encryptedPayload)
  }
  return encryptedPayload
}

async function encryptHybridString(plaintext, publicKey) {
  return encryptHybridRaw(stringToArray(plaintext), publicKey)
}

/**
 * Hybrid decryption
 * - decrypt the access key with the private key
 * - decrypt the data with the access key
 * @param {string} encryptedPayload base64 string represents the encrypted payload
 * @param {Uint8Array} privateKey private key used to decrypt the data key
 * @returns {Promise.<ArrayBuffer>} Promise of raw plaintext byte array
 */
async function decryptHybridRaw(encryptedPayload, privateKey, decode = true) {
  if (encryptedPayload === null) return null
  try {
    const payload = decode ? base64ToJson(encryptedPayload) : encryptedPayload
    const accessKey = await decryptKeyWithPrivateKey(
      payload.encryptedKey,
      privateKey
    );
    const decryptedDataArray = await decrypt(
      payload.encryptedData,
      accessKey,
      decode
    )
    return decryptedDataArray
  } catch (err) {
    console.log(err)
    throw new Error("Hybrid decryption error: ", err)
  }
}

async function decryptHybridString(encryptedPayload, privateKey) {
  const decryptedDataArray = await decryptHybridRaw(encryptedPayload, privateKey)
  return arrayToString(decryptedDataArray)
}

/**
 * Derive two passwords from input password
 * @param {string} password
 * @returns {Promise.<{string, string}>} Promise of derived passwords
 */
async function derivePasswords(password) {
  try {
    const passwordHashBuffer = await crypto.subtle.digest(
      "SHA-512",
      stringToArray(password),
    )
    const authPasswordBuffer = passwordHashBuffer.slice(0, 32)
    const walletPasswordBuffer = passwordHashBuffer.slice(32, 64)
    const authPassword = arrayToBase64(authPasswordBuffer)
    const walletPassword = arrayToBase64(walletPasswordBuffer)
    return { authPassword, walletPassword }
  } catch (err) {
    throw new Error("Password derivation error: ", err)
  }
}

module.exports = {
  deriveAddress,
  exportKeyToBase64,
  importKeyFromBase64,
  importKeyFromSeed,
  digest,
  digestRaw,
  signHash,
  signString,
  verifyHash,
  verifyString,
  encrypt,
  decrypt,
  deriveKey,
  generateKey,
  generateKeyPair,
  encryptRawWithPublicKey,
  decryptRawWithPrivateKey,
  encryptStringWithPublicKey,
  decryptStringWithPrivateKey,
  encryptHybridRaw,
  encryptHybridString,
  decryptHybridRaw,
  decryptHybridString,
  derivePasswords,
  importRSAPublicKey,
  importRSACryptoKey
}
