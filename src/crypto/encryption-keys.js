const { base64ToArray } = require('./encoding-helpers');

const fromMembership = (membership) => {
  return new EncryptionKeys(
    membership.state.encryptionType,
    membership.state.keys,
    membership.state.encAccessKey,
    membership.dataRoom?.state?.publicKeys
  )
}

const fromProfileState = (profileState) => {
  return new EncryptionKeys(
    profileState.encryptionType,
    profileState.keys,
    profileState.encAccessKey
  )
}

const fromMembershipContract = (membership) => {
  return new EncryptionKeys("KEYS_STRUCTURE", membership.keys)
}

const EncryptionKeys = (function () {
  class EncryptionKeys {

    constructor(encryptionType, keys, encAccessKey, publicKeys) {
      this.encryptionType = encryptionType
      this.keys = keys || []
      this.encAccessKey = encAccessKey
      this.publicKeys = publicKeys || []
    }
  
    getPublicKey() {
      if (Array.isArray(this.publicKeys) && this.publicKeys.length > 0) {
        return base64ToArray(this.publicKeys[this.publicKeys.length - 1])
      }
      return null
    }
  
    setPublicKey(publicKey) {
      this.publicKeys.push(publicKey)
    }
  
    setPublicKeys(publicKeys) {
      this.publicKeys = publicKeys
    }
  }
  return EncryptionKeys;
})();


module.exports = {
  fromMembership,
  fromProfileState,
  fromMembershipContract,
  EncryptionKeys
}
