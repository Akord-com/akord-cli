const {
  base64ToJson, arrayToString, stringToArray, base64ToArray, arrayToDataUrl
} = require('../encoding-helpers');
const { cloneDeep } = require("lodash");

/**
 * Abstract de-/encryption methods
 * ts TODO: move to abstract class with default implementations
 */
module.exports = (function () {
  class Encrypter {

    constructor(publicKey) {
      this.publicKey = publicKey
    }

    setPublicKey(publicKey) {
      this.publicKey = base64ToArray(publicKey)
    }

    setRawPublicKey(publicKey) {
      this.publicKey = publicKey
    }

    async decryptDataroom(dataroomState) {
      const decryptedDataroomState = await this.decryptObject(
        dataroomState,
        ['title', 'description']
      )
      if (dataroomState.termsOfAccess)
        decryptedDataroomState.termsOfAccess = base64ToJson(
          dataroomState.termsOfAccess
        )
      return decryptedDataroomState
    }

    async decryptState(state) {
      const newState = cloneDeep(state)
      const decryptedState = await this.decryptObject(
        newState,
        ['name']
      )
      return decryptedState;
    }

    async decryptMember(memberDetails) {
      const decryptedMemberDetails = await this.decryptObject(
        memberDetails,
        ['fullName', 'avatarUrl', 'phone']
      )
      return decryptedMemberDetails
    }

    async decryptSelf(memberDetails) {
      this.decryptedKeys = [{
        publicKey: this.wallet.publicKey(),
        privateKey: this.wallet.privateKeyRaw()
      }]
      return this.decryptMember(memberDetails)
    }

    async decryptStack(stack) {
      const newState = cloneDeep(stack)
      const decryptedStack = await this.decryptObject(
        newState,
        ['name']
      )
      return decryptedStack
    }

    async decryptMemo(memo) {
      const newState = cloneDeep(memo)
      const decryptedMemo = await this.decryptObject(
        newState,
        ['message']
      )
      return decryptedMemo
    }

    async decryptOperation(operation) {
      let decryptedOperation = {}
      switch (operation.actionRef) {
        case 'DATAROOM_CREATE':
        case 'FOLDER_CREATE':
        case 'FOLDER_DELETE':
        case 'FOLDER_REVOKE':
        case 'FOLDER_RESTORE':
        case 'FOLDER_MOVE':
          decryptedOperation = await this.decryptObject(
            operation,
            ['title']
          )
          if (operation.termsOfAccess)
            decryptedOperation.termsOfAccess = base64ToJson(
              operation.termsOfAccess
            )
          if (operation.folder) {
            // decrypt the current title for the folder
            decryptedOperation.folder = await this.decryptObject(
              operation.folder,
              ['title']
            )
          }
          break
        case 'STACK_DELETE':
        case 'STACK_REMOVE':
        case 'STACK_REVOKE':
        case 'STACK_RESTORE':
        case 'STACK_CREATE':
        case 'STACK_UPLOAD_REVISION':
        case 'STACK_MOVE':
          decryptedOperation = await this.decryptObject(
            operation,
            ['title', 'thumbnailUrl']
          )
          if (operation.files && operation.files.length > 0) {
            // decrypt the original name for the new file in the stack
            decryptedOperation.files[0] = await this.decryptObject(
              operation.files[0],
              ['title']
            )
          }
          if (operation.stack) {
            // decrypt the current title for the stack
            decryptedOperation.stack = await this.decryptObject(
              operation.stack,
              ['title']
            )
          }
          break
        case 'STACK_RENAME':
        case 'DATAROOM_RENAME':
        case 'FOLDER_RENAME':
          if (operation.encodedPrevState) {
            const decodedPrevState = base64ToJson(
              operation.encodedPrevState
            )
            operation.prevTitle = decodedPrevState.title
          }
          decryptedOperation = await this.decryptObject(
            operation,
            ['title', 'prevTitle']
          )
          break
        case 'MEMO_WRITE':
          decryptedOperation = await this.decryptObject(
            operation,
            ['message']
          )
          break
        default:
          return operation
      }
      return decryptedOperation
    }

    async decryptObject(encryptedObject, fieldsToDecrypt) {
      let decryptedObject = encryptedObject;
      const promises = fieldsToDecrypt.map(async fieldName => {
        if (
          decryptedObject[fieldName] &&
          decryptedObject[fieldName] !== null &&
          decryptedObject[fieldName] !== ''
        ) {
          const decryptedValue = await this.decryptRaw(decryptedObject[fieldName])
          if (fieldName === 'thumbnailUrl' || fieldName === 'avatarUrl') {
            decryptedObject[fieldName] = arrayToDataUrl(decryptedValue)
          } else {
            decryptedObject[fieldName] = arrayToString(decryptedValue)
          }
        }
      })
      return Promise.all(promises).then(() => decryptedObject)
    }

    async encryptMemberKeys() {
      throw new Error('Abstract method encryptMemberKeys needs to be implemented in the subclass');
    }

    async encryptMemberKey() {
      throw new Error('Abstract method encryptMemberKey needs to be implemented in the subclass');
    }

    async encryptRaw() {
      throw new Error('Abstract method encryptRaw needs to be implemented in the subclass');
    }

    async decryptRaw() {
      throw new Error('Abstract method decryptRaw needs to be implemented in the subclass');
    }

    async encryptString(_string) {
      return this.encryptRaw(stringToArray(_string))
    }

    async decryptString(_encryptedString) {
      const decryptedDataArray = await this.decryptRaw(_encryptedString)
      return arrayToString(decryptedDataArray);
    }
  }

  return Encrypter;
})();
