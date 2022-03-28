const cryptoHelper = require("./crypto/crypto-helpers");
const { getContract, constructHeader } = require("./helpers");
const { initContractId, postTransaction } = require("./bundler");
const { arrayToBase64, jsonToBase64 } = require('./crypto/encoding-helpers');
const EncrypterFactory = require('./crypto/encrypter/encrypter-factory');
const { tags, objectTypes, role, commands, status } = require('./constants');
const KeysStructureEncrypter = require("./crypto/encrypter/keys-structure-encrypter");

module.exports = (function () {
  class Wrapper {
    constructor(wallet, encryptionKeys, vaultContract, membershipContract) {
      this.wallet = wallet
      this.vaultContract = vaultContract
      this.membershipContract = membershipContract
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

    setVaultContract(vaultContract) {
      this.vaultContract = vaultContract
    }

    setMembershipContract(membershipContract) {
      this.membershipContract = membershipContract
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

      if (this.membershipContract) {
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
          headerPayload[tags.COMMAND] = commands.VAULT_CREATE;
          // bodyPayload.publicKeys = [arrayToBase64(publicKey)]
          bodyPayload.keyRotate = {
            publicKey: publicKey,
            privateKey: privateKey
          }
          const contract = getContract(contractTxId, this.wallet.wallet);
          this.setVaultContract(contract);
          headerPayload[tags.OBJECT_CONTRACT_ID] = contractTxId;

          const address = await this.wallet.getAddress();
          const membershipContractTxId = await initContractId(objectTypes.MEMBERSHIP, {
            [tags.VAULT_CONTRACT_ID]: contractTxId,
            [tags.OBJECT_CONTRACT_TYPE]: objectTypes.MEMBERSHIP,
            [tags.MEMBER_ADDRESS]: address
          });
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.MEMBERSHIP,
            "id": membershipContractTxId,
          })
          this.setRawKeysEncryptionPublicKey(this.wallet.publicKeyRaw());
          this.setRawDataEncryptionPublicKey(publicKey);

          const memberContract = getContract(membershipContractTxId, this.wallet.wallet);
          this.setMembershipContract(memberContract);
          this.setContractId(contractTxId);
          headerPayload[tags.MEMBER_ADDRESS] = address;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.VAULT
          break;
        }
        case 'VAULT_RENAME':
          this.setContractId(this.vaultContract.txId());
          headerPayload[tags.COMMAND] = commands.VAULT_UPDATE
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.VAULT;
          headerPayload[tags.OBJECT_CONTRACT_ID] = this.vaultContract.txId();
          break
        case 'MEMBERSHIP_INVITE': {
          bodyPayload.memberKeys = [];
          const publicKey = await this.wallet.getPublicKeyFromAddress(bodyPayload.address);
          this.setRawKeysEncryptionPublicKey(publicKey);
          headerPayload[tags.COMMAND] = commands.MEMBERSHIP_INVITE
          const membershipContractTxId = await initContractId(
            objectTypes.MEMBERSHIP,
            {
              [tags.VAULT_CONTRACT_ID]: this.vaultContract.txId(),
              [tags.OBJECT_CONTRACT_TYPE]: objectTypes.MEMBERSHIP,
              [tags.MEMBER_ADDRESS]: bodyPayload.address
            });
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.MEMBERSHIP,
            "id": membershipContractTxId,
          })
          this.setContractId(membershipContractTxId);
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMBERSHIP;
          headerPayload[tags.OBJECT_CONTRACT_ID] = membershipContractTxId;
          headerPayload[tags.MEMBER_ADDRESS] = bodyPayload.address;
          break;
        }
        case 'MEMBERSHIP_ACCEPT':
          headerPayload[tags.COMMAND] = commands.MEMBERSHIP_ACCEPT;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMBERSHIP;
          headerPayload[tags.OBJECT_CONTRACT_ID] = this.membershipContract.txId();
          break
        case 'MEMBERSHIP_REJECT':
          headerPayload[tags.COMMAND] = commands.MEMBERSHIP_REJECT;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMBERSHIP;
          headerPayload[tags.OBJECT_CONTRACT_ID] = this.membershipContract.txId();
          break
        case 'MEMBERSHIP_REVOKE': {
          const { privateKey, publicKey } = await cryptoHelper.generateKeyPair();
          headerPayload[tags.COMMAND] = commands.MEMBERSHIP_REVOKE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMBERSHIP;
          headerPayload[tags.OBJECT_CONTRACT_ID] = this.membershipContract.txId();
          const vaultState = await this.getLatestVaultState();
          for (let member of vaultState.memberships) {
            const memberContract = getContract(member, this.wallet.wallet);
            const memberState = await memberContract.readState();
            if (member !== header.modelId
              && (memberState.state.status === role.ACCEPTED || memberState.state.status === role.PENDING)) {
              const memberPublicKey = await this.wallet.getPublicKeyFromAddress(memberState.state.address);
              this.memberKeysEncrypter = new KeysStructureEncrypter(
                this.wallet,
                this.keysEncrypter.keys,
                memberPublicKey
              );
              const publicKeyJWK = await cryptoHelper.importRSAPublicKey(memberPublicKey);
              const encPrivateKey = await cryptoHelper.encryptRawForArweavePublicKey(
                publicKeyJWK,
                privateKey
              )
              bodyPayload.keys = [
                {
                  id: member,
                  address: memberState.state.address,
                  keys: [{
                    publicKey: arrayToBase64(publicKey),
                    encPrivateKey: encPrivateKey
                  }]
                }
              ];
            }
          }
          break;
        }
        case 'STACK_CREATE':
          const stackContractTxId = await initContractId(
            objectTypes.STACK,
            {
              [tags.VAULT_CONTRACT_ID]: this.vaultContract.txId(),
              [tags.OBJECT_CONTRACT_TYPE]: objectTypes.STACK
            });
          headerPayload[tags.OBJECT_CONTRACT_ID] = stackContractTxId;
          this.setContractId(stackContractTxId);
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.STACK,
            "id": stackContractTxId,
          })
          headerPayload[tags.COMMAND] = commands.STACK_CREATE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          bodyPayload.name = bodyPayload.file.name;
          break
        case 'STACK_RENAME':
          headerPayload[tags.COMMAND] = commands.STACK_UPDATE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          break
        case 'FOLDER_CREATE':
          const folderContractTxId = await initContractId(
            objectTypes.FOLDER,
            {
              [tags.VAULT_CONTRACT_ID]: this.vaultContract.txId(),
              [tags.OBJECT_CONTRACT_TYPE]: objectTypes.FOLDER
            });
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.FOLDER,
            "id": folderContractTxId,
          })
          headerPayload[tags.OBJECT_CONTRACT_ID] = folderContractTxId;
          this.setContractId(folderContractTxId);
          headerPayload[tags.COMMAND] = commands.FOLDER_CREATE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          break
        case 'MEMO_CREATE':
          const memoContractTxId = await initContractId(
            objectTypes.MEMO,
            {
              [tags.VAULT_CONTRACT_ID]: this.vaultContract.txId(),
              [tags.OBJECT_CONTRACT_TYPE]: objectTypes.MEMO
            });
          headerPayload[tags.OBJECT_CONTRACT_ID] = memoContractTxId;
          this.setContractId(memoContractTxId);
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.MEMO,
            "id": memoContractTxId,
          })
          headerPayload[tags.COMMAND] = commands.MEMO_CREATE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMO;
          break
        case 'VAULT_ARCHIVE':
          headerPayload[tags.COMMAND] = commands.VAULT_ARCHIVE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.VAULT;
          bodyPayload.status = status.ARCHIVED
          break
        case 'VAULT_RESTORE':
          headerPayload[tags.COMMAND] = commands.VAULT_RESTORE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.VAULT;
          bodyPayload.status = status.ARCHIVED
          break
        case 'STACK_REVOKE':
          headerPayload[tags.COMMAND] = commands.STACK_REVOKE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          bodyPayload.status = status.REVOKED
          break
        case 'STACK_REVOKE':
          headerPayload[tags.COMMAND] = commands.STACK_RESTORE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          bodyPayload.status = status.ACTIVE
          break
        case 'STACK_DELETE':
          headerPayload[tags.COMMAND] = commands.STACK_DELETE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          bodyPayload.status = status.DELETED
          break
        case 'FOLDER_REVOKE':
          headerPayload[tags.COMMAND] = commands.FOLDER_REVOKE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          bodyPayload.status = status.REVOKED
          break
        case 'FOLDER_RESTORE':
          headerPayload[tags.COMMAND] = commands.FOLDER_RESTORE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          bodyPayload.status = status.ACTIVE
          break
        case 'FOLDER_DELETE':
          headerPayload[tags.COMMAND] = commands.FOLDER_DELETE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          bodyPayload.status = status.DELETED
          break
        case 'STACK_RENAME':
        case 'STACK_UPLOAD_REVISION':
          headerPayload[tags.COMMAND] = commands.STACK_UPDATE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          break
        case 'STACK_MOVE':
          headerPayload[tags.COMMAND] = commands.STACK_MOVE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          break
        case 'FOLDER_RENAME':
          headerPayload[tags.COMMAND] = commands.FOLDER_UPDATE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          break
        case 'FOLDER_MOVE':
          headerPayload[tags.COMMAND] = commands.FOLDER_MOVE;
          headerPayload[tags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          break
        default:
          throw new Error('Unknown action ref: ' + actionRef)
      }

      // build the transaction header
      const address = await this.wallet.getAddress();
      headerPayload[tags.SIGNER_ADDRESS] = address;
      headerPayload[tags.VAULT_CONTRACT_ID] = this.vaultContract.txId();
      headerPayload[tags.MEMBERSHIP_CONTRACT_ID] = this.membershipContract.txId();
      const fullHeader = constructHeader(headerPayload);

      // build & encrypt the transaction body
      const encryptedBody = await this.constructBody(bodyPayload);

      const txInput = await this.signTransaction(fullHeader, encryptedBody);
      const { txId, pstTransfer } = await postTransaction(
        headerPayload[tags.OBJECT_CONTRACT_ID],
        { function: "write", ...txInput },
        fullHeader
      );
      response.objectId = headerPayload[tags.OBJECT_CONTRACT_ID];
      response.vaultId = this.vaultContract.txId();
      response.membershipId = this.membershipContract.txId();
      response.type = headerPayload[tags.OBJECT_CONTRACT_TYPE];
      response.transactions.push({
        "type": "contract-interaction",
        "id": txId,
        "pstTransfer": JSON.stringify(pstTransfer)
      })
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
      const signature = await cryptoHelper.signString(`${encodedHeader}${encodedBody}`, this.wallet.signingPrivateKeyRaw());
      // const signature = await this.wallet.sign(`${encodedHeader}${encodedBody}`);
      return { header: encodedHeader, body: encodedBody, publicKey, signature };
    }

    async getLatestVaultState() {
      const latestVaultState = await this.vaultContract.readState();
      return latestVaultState.state;
    }

    async getLatestMembershipState() {
      const latestMembershipState = await this.membershipContract.readState();
      return latestMembershipState.state;
    }
  }
  return Wrapper;
})();