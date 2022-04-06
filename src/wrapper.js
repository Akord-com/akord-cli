const cryptoHelper = require("./crypto/crypto-helpers");
const { constructHeader } = require("./helpers");
const { initContractId, postTransaction, uploadFile, getContractState } = require("./api-mock");
const { jsonToBase64 } = require('./crypto/encoding-helpers');
const EncrypterFactory = require('./crypto/encrypter/encrypter-factory');
const { protocolTags, objectTypes, commands, status } = require('./constants');
const KeysStructureEncrypter = require("./crypto/encrypter/keys-structure-encrypter");

module.exports = (function () {
  class Wrapper {
    constructor(wallet, encryptionKeys, vaultContractId, membershipContractId) {
      this.wallet = wallet
      this.vaultContractId = vaultContractId
      this.membershipContractId = membershipContractId
      // for the data encryption
      this.dataEncrypter = new EncrypterFactory(
        this.wallet,
        encryptionKeys
      ).encrypterInstance()
      // for the member keys encryption
      this.keysEncrypter = new EncrypterFactory(
        this.wallet,
        encryptionKeys
      ).encrypterInstance()
    }

    setRawDataEncryptionPublicKey(publicKey) {
      this.dataEncrypter.setRawPublicKey(publicKey)
    }

    setDataEncryptionPublicKey(publicKey) {
      this.dataEncrypter.setPublicKey(publicKey)
    }

    setKeysEncryptionPublicKey(publicKey) {
      this.keysEncrypter.setRawPublicKey(publicKey)
    }

    setRawKeysEncryptionPublicKey(publicKey) {
      this.keysEncrypter.setRawPublicKey(publicKey)
    }

    setVaultContractId(vaultContractId) {
      this.vaultContractId = vaultContractId
    }

    setMembershipContractId(membershipContractId) {
      this.membershipContractId = membershipContractId
    }

    setContractId(contractId) {
      this.contractId = contractId
    }

    setTransactionId(transactionId) {
      this.transactionId = transactionId
    }


    async dispatch(actionRef, header, body) {
      let bodyPayload = body ? body : {}
      let headerPayload = header ? header : {}

      let response = {
        transactions: []
      };

      if (this.membershipContractId) {
        await this.dataEncrypter._decryptKeys();
        this.setRawDataEncryptionPublicKey(this.dataEncrypter.decryptedKeys[this.dataEncrypter.decryptedKeys.length - 1].publicKey);
      }

      switch (actionRef) {
        case 'VAULT_CREATE': {
          // generate a new vault key pair
          const { privateKey, publicKey } = await cryptoHelper.generateKeyPair()
          const contractTxId = await initContractId(objectTypes.VAULT, {});
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.VAULT,
            "id": contractTxId,
          })
          headerPayload[protocolTags.COMMAND] = commands.VAULT_CREATE;
          bodyPayload.keyRotate = {
            publicKey: publicKey,
            privateKey: privateKey
          }
          this.setVaultContractId(contractTxId);
          headerPayload[protocolTags.OBJECT_CONTRACT_ID] = contractTxId;
          bodyPayload.publicSigningKey = await this.wallet.signingPublicKey();

          const address = await this.wallet.getAddress();
          const membershipContractTxId = await initContractId(objectTypes.MEMBERSHIP, {
            [protocolTags.VAULT_CONTRACT_ID]: contractTxId,
            [protocolTags.OBJECT_CONTRACT_TYPE]: objectTypes.MEMBERSHIP,
            [protocolTags.MEMBER_ADDRESS]: address
          });
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.MEMBERSHIP,
            "id": membershipContractTxId,
          })
          const userPublicKey = await this.wallet.publicKeyRaw();
          this.setRawKeysEncryptionPublicKey(userPublicKey);
          this.setRawDataEncryptionPublicKey(publicKey);

          this.setMembershipContractId(membershipContractTxId);
          this.setContractId(contractTxId);
          headerPayload[protocolTags.MEMBER_ADDRESS] = address;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.VAULT
          break;
        }
        case 'VAULT_RENAME':
          this.setContractId(this.vaultContractId);
          headerPayload[protocolTags.COMMAND] = commands.VAULT_UPDATE
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.VAULT;
          headerPayload[protocolTags.OBJECT_CONTRACT_ID] = this.contractId;
          break
        case 'MEMBERSHIP_INVITE': {
          bodyPayload.memberKeys = [];
          const publicKey = await this.wallet.getPublicKeyFromAddress(bodyPayload.address);
          this.setRawKeysEncryptionPublicKey(publicKey);
          headerPayload[protocolTags.COMMAND] = commands.MEMBERSHIP_INVITE
          const membershipContractTxId = await initContractId(
            objectTypes.MEMBERSHIP,
            {
              [protocolTags.VAULT_CONTRACT_ID]: this.vaultContractId,
              [protocolTags.OBJECT_CONTRACT_TYPE]: objectTypes.MEMBERSHIP,
              [protocolTags.MEMBER_ADDRESS]: bodyPayload.address
            });
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.MEMBERSHIP,
            "id": membershipContractTxId,
          })
          this.setContractId(membershipContractTxId);
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMBERSHIP;
          headerPayload[protocolTags.OBJECT_CONTRACT_ID] = membershipContractTxId;
          headerPayload[protocolTags.MEMBER_ADDRESS] = bodyPayload.address;
          break;
        }
        case 'MEMBERSHIP_ACCEPT':
          headerPayload[protocolTags.COMMAND] = commands.MEMBERSHIP_ACCEPT;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMBERSHIP;
          bodyPayload.publicSigningKey = this.wallet.signingPublicKeyRaw();
          break;
        case 'MEMBERSHIP_REJECT':
          headerPayload[protocolTags.COMMAND] = commands.MEMBERSHIP_REJECT;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMBERSHIP;
          break;
        case 'MEMBERSHIP_REVOKE': {
          const { privateKey, publicKey } = await cryptoHelper.generateKeyPair();
          headerPayload[protocolTags.COMMAND] = commands.MEMBERSHIP_REVOKE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMBERSHIP;
          const vaultState = await getContractState(this.vaultContractId);
          bodyPayload.keys = [];
          for (let member of vaultState.memberships) {
            const memberState = await getContractState(member);
            if (member !== headerPayload[protocolTags.OBJECT_CONTRACT_ID]
              && (memberState.state.status === status.ACCEPTED || memberState.state.status === status.PENDING)) {
              const memberPublicKey = await this.wallet.getPublicKeyFromAddress(memberState.state.address);
              const memberKeysEncrypter = new KeysStructureEncrypter(
                this.wallet,
                this.keysEncrypter.keys,
                memberPublicKey
              );
              const keys = await memberKeysEncrypter.encryptMemberKey({
                publicKey: publicKey,
                privateKey: privateKey
              });
              bodyPayload.keys.push(
                {
                  id: member,
                  address: memberState.state.address,
                  keyPair: keys
                }
              );
            }
          }
          break;
        }
        case 'STACK_CREATE':
          const stackContractTxId = await initContractId(
            objectTypes.STACK,
            {
              [protocolTags.VAULT_CONTRACT_ID]: this.vaultContractId,
              [protocolTags.OBJECT_CONTRACT_TYPE]: objectTypes.STACK
            });
          headerPayload[protocolTags.OBJECT_CONTRACT_ID] = stackContractTxId;
          this.setContractId(stackContractTxId);
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.STACK,
            "id": stackContractTxId,
          })
          headerPayload[protocolTags.COMMAND] = commands.STACK_CREATE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          bodyPayload.name = bodyPayload.file.name;
          break;
        case 'STACK_RENAME':
          headerPayload[protocolTags.COMMAND] = commands.STACK_UPDATE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          break;
        case 'FOLDER_CREATE':
          const folderContractTxId = await initContractId(
            objectTypes.FOLDER,
            {
              [protocolTags.VAULT_CONTRACT_ID]: this.vaultContractId,
              [protocolTags.OBJECT_CONTRACT_TYPE]: objectTypes.FOLDER
            });
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.FOLDER,
            "id": folderContractTxId,
          })
          headerPayload[protocolTags.OBJECT_CONTRACT_ID] = folderContractTxId;
          this.setContractId(folderContractTxId);
          headerPayload[protocolTags.COMMAND] = commands.FOLDER_CREATE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          break;
        case 'MEMO_CREATE':
          const memoContractTxId = await initContractId(
            objectTypes.MEMO,
            {
              [protocolTags.VAULT_CONTRACT_ID]: this.vaultContractId,
              [protocolTags.OBJECT_CONTRACT_TYPE]: objectTypes.MEMO
            });
          headerPayload[protocolTags.OBJECT_CONTRACT_ID] = memoContractTxId;
          this.setContractId(memoContractTxId);
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.MEMO,
            "id": memoContractTxId,
          })
          headerPayload[protocolTags.COMMAND] = commands.MEMO_CREATE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMO;
          break;
        case 'VAULT_ARCHIVE':
          headerPayload[protocolTags.COMMAND] = commands.VAULT_ARCHIVE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.VAULT;
          bodyPayload.status = status.ARCHIVED
          break;
        case 'VAULT_RESTORE':
          headerPayload[protocolTags.COMMAND] = commands.VAULT_RESTORE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.VAULT;
          bodyPayload.status = status.ARCHIVED
          break;
        case 'STACK_REVOKE':
          headerPayload[protocolTags.COMMAND] = commands.STACK_REVOKE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          bodyPayload.status = status.REVOKED
          break;
        case 'STACK_REVOKE':
          headerPayload[protocolTags.COMMAND] = commands.STACK_RESTORE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          bodyPayload.status = status.ACTIVE
          break;
        case 'STACK_DELETE':
          headerPayload[protocolTags.COMMAND] = commands.STACK_DELETE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          bodyPayload.status = status.DELETED
          break;
        case 'FOLDER_REVOKE':
          headerPayload[protocolTags.COMMAND] = commands.FOLDER_REVOKE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          bodyPayload.status = status.REVOKED
          break
        case 'FOLDER_RESTORE':
          headerPayload[protocolTags.COMMAND] = commands.FOLDER_RESTORE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          bodyPayload.status = status.ACTIVE
          break;
        case 'FOLDER_DELETE':
          headerPayload[protocolTags.COMMAND] = commands.FOLDER_DELETE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          bodyPayload.status = status.DELETED
          break;
        case 'STACK_RENAME':
        case 'STACK_UPLOAD_REVISION':
          headerPayload[protocolTags.COMMAND] = commands.STACK_UPDATE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          break;
        case 'STACK_MOVE':
          headerPayload[protocolTags.COMMAND] = commands.STACK_MOVE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          break
        case 'FOLDER_RENAME':
          headerPayload[protocolTags.COMMAND] = commands.FOLDER_UPDATE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          break;
        case 'FOLDER_MOVE':
          headerPayload[protocolTags.COMMAND] = commands.FOLDER_MOVE;
          headerPayload[protocolTags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          break;
        default:
          throw new Error('Unknown action ref: ' + actionRef);
      }

      // build the transaction header
      const address = await this.wallet.getAddress();
      headerPayload[protocolTags.SIGNER_ADDRESS] = address;
      headerPayload[protocolTags.VAULT_CONTRACT_ID] = this.vaultContractId;
      headerPayload[protocolTags.MEMBERSHIP_CONTRACT_ID] = this.membershipContractId;
      const fullHeader = constructHeader(headerPayload);

      // build & encrypt the transaction body
      const encryptedBody = await this.constructBody(bodyPayload);

      const txInput = await this.signTransaction(fullHeader, encryptedBody);
      const { txId, pstTransfer } = await postTransaction(
        headerPayload[protocolTags.OBJECT_CONTRACT_ID],
        { function: "write", ...txInput },
        fullHeader
      );
      response.objectId = headerPayload[protocolTags.OBJECT_CONTRACT_ID];
      response.vaultId = this.vaultContractId;
      response.membershipId = this.membershipContractId;
      response.type = headerPayload[protocolTags.OBJECT_CONTRACT_TYPE];
      response.transactions.push({
        "type": "contract-interaction",
        "id": txId,
        "pstTransfer": JSON.stringify(pstTransfer)
      });
      this.setTransactionId(txId);
      return response;
    }

    async constructBody(payload) {
      let encryptedBody = {}
      for (let fieldName in payload) {
        if (payload[fieldName]) {
          switch (fieldName) {
            case 'name':
            case 'title':
            case 'message':
            case 'description': {
              encryptedBody[fieldName] = await this.dataEncrypter.encryptString(
                payload[fieldName]
              )
              break
            }
            case 'file': {
              const file = payload[fieldName];
              if (!file.resourceTx) {
                const encryptedFile = await this.dataEncrypter.encryptRaw(file.data);
                const fileId = await uploadFile(encryptedFile);
                file.resourceTx = fileId;
              }
              const encryptedName = await this.dataEncrypter.encryptString(file.name);
              encryptedBody.files = [
                {
                  postedAt: Date.now(),
                  name: encryptedName,
                  type: file.type,
                  size: file.size,
                  resourceTx: file.resourceTx
                }
              ]
              break
            }
            case 'memberKeys': {
              encryptedBody.keys = await this.keysEncrypter.encryptMemberKeys(
                payload[fieldName]
              );
              break
            }
            case 'keyRotate': {
              encryptedBody.keys = [await this.keysEncrypter.encryptMemberKey(payload[fieldName])];
              break
            }
            case 'publicSigningKey': {
              encryptedBody.encPublicSigningKey = await this.dataEncrypter.encryptRaw(
                payload[fieldName]
              )
              break
            }
            default:
              encryptedBody[fieldName] = payload[fieldName]
              break
          }
        }
      }
      return encryptedBody
    }

    async signTransaction(header, body) {
      const publicKey = await this.wallet.signingPublicKey();
      const encodedHeader = jsonToBase64(header);
      const encodedBody = jsonToBase64(body);
      const signature = await this.wallet.sign(`${encodedHeader}${encodedBody}`);
      return { header: encodedHeader, body: encodedBody, publicKey, signature };
    }
  }
  return Wrapper;
})();