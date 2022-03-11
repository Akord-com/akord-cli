const { getPublicKeyFromAddress } = require("./arweave-helpers");
const { codeSources } = require("./config");
const cryptoHelper = require("./crypto/crypto-helpers");
const {
  getContract,
  deployContract,
  postContractTransaction,
  initContract,
  constructHeader
} = require("./helpers");
const { arrayToBase64, jsonToBase64 } = require('./crypto/encoding-helpers');
const EncrypterFactory = require('./crypto/encrypter/encrypter-factory');
const { svpTags, objectTypes, role, commands, status } = require('./constants');

const contractSrcPostfix = "-Contract-Src";

module.exports = (function () {
  class SVPWrapper {
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

    async setKeysEncryptionPublicKey(publicKey) {
      const publicKeyJWK = await cryptoHelper.importRSAPublicKey(publicKey);
      this.keysEncrypter.setRawPublicKey(publicKeyJWK)
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

      if (this.vaultContract) {
        const state = await this.getLatestVaultState();
        this.setDataEncryptionPublicKey(state.publicKeys[state.publicKeys.length - 1]);
      }

      switch (actionRef) {
        case 'VAULT_CREATE': {
          // generate a new vault key pair
          const { privateKey, publicKey } = await cryptoHelper.generateKeyPair()
          const contractTxId = await deployContract(
            codeSources[objectTypes.VAULT + contractSrcPostfix],
            {},
            constructHeader(),
            this.wallet.wallet
          );
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.VAULT,
            "id": contractTxId,
          })
          headerPayload[svpTags.COMMAND] = commands.VAULT_CREATE;
          bodyPayload.publicKeys = [arrayToBase64(publicKey)]
          bodyPayload.keyRotate = {
            publicKey: publicKey,
            privateKey: privateKey
          }
          const contract = getContract(contractTxId, this.wallet.wallet);
          this.setVaultContract(contract);
          headerPayload[svpTags.OBJECT_CONTRACT_ID] = contractTxId;

          const address = await this.wallet.getAddress();
          const membershipContractTxId = await initContract(
            codeSources[objectTypes.MEMBERSHIP + contractSrcPostfix],
            {
              [svpTags.VAULT_CONTRACT_ID]: contractTxId,
              [svpTags.OBJECT_CONTRACT_TYPE]: objectTypes.MEMBERSHIP,
              [svpTags.MEMBER_ADDRESS]: address
            }, this.wallet.wallet);
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.MEMBERSHIP,
            "id": membershipContractTxId,
          })
          const memberPublicKey = await this.wallet.getPublicKey();
          await this.setKeysEncryptionPublicKey(memberPublicKey);
          this.setRawDataEncryptionPublicKey(publicKey);

          const memberContract = getContract(membershipContractTxId, this.wallet.wallet);
          this.setMembershipContract(memberContract);
          this.setContractId(contractTxId);
          headerPayload[svpTags.MEMBER_ADDRESS] = address;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.VAULT
          break;
        }
        case 'VAULT_RENAME':
          this.setContractId(this.vaultContract.txId());
          headerPayload[svpTags.COMMAND] = commands.VAULT_UPDATE
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.VAULT;
          headerPayload[svpTags.OBJECT_CONTRACT_ID] = this.vaultContract.txId();
          break
        case 'MEMBERSHIP_INVITE': {
          bodyPayload.memberKeys = [];
          const publicKey = await getPublicKeyFromAddress(bodyPayload.address);
          await this.setKeysEncryptionPublicKey(publicKey)
          headerPayload[svpTags.COMMAND] = commands.MEMBERSHIP_INVITE
          const membershipContractTxId = await initContract(
            codeSources[objectTypes.MEMBERSHIP + contractSrcPostfix],
            {
              [svpTags.VAULT_CONTRACT_ID]: this.vaultContract.txId(),
              [svpTags.OBJECT_CONTRACT_TYPE]: objectTypes.MEMBERSHIP,
              [svpTags.MEMBER_ADDRESS]: bodyPayload.address
            }, this.wallet.wallet);
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.MEMBERSHIP,
            "id": membershipContractTxId,
          })
          this.setContractId(membershipContractTxId);
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMBERSHIP;
          headerPayload[svpTags.OBJECT_CONTRACT_ID] = membershipContractTxId;
          headerPayload[svpTags.MEMBER_ADDRESS] = bodyPayload.address;
          break;
        }
        case 'MEMBERSHIP_ACCEPT':
          headerPayload[svpTags.COMMAND] = commands.MEMBERSHIP_ACCEPT;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMBERSHIP;
          headerPayload[svpTags.OBJECT_CONTRACT_ID] = this.membershipContract.txId();
          break
        case 'MEMBERSHIP_REJECT':
          headerPayload[svpTags.COMMAND] = commands.MEMBERSHIP_REJECT;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMBERSHIP;
          headerPayload[svpTags.OBJECT_CONTRACT_ID] = this.membershipContract.txId();
          break
        case 'MEMBERSHIP_REVOKE': {
          const { privateKey, publicKey } = await cryptoHelper.generateKeyPair();
          headerPayload[svpTags.COMMAND] = commands.MEMBERSHIP_REVOKE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMBERSHIP;
          headerPayload[svpTags.OBJECT_CONTRACT_ID] = this.membershipContract.txId();
          const vaultState = await this.getLatestVaultState();
          for (let member of vaultState.memberships) {
            const memberContract = getContract(member, this.wallet.wallet);
            const memberState = await memberContract.readState();
            if (member !== header.modelId
              && (memberState.state.status === role.ACCEPTED || memberState.state.status === role.PENDING)) {
              const memberPublicKey = await getPublicKeyFromAddress(memberState.state.address);
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
          bodyPayload.publicKeys = [arrayToBase64(publicKey)]
          break;
        }
        case 'STACK_CREATE':
          const stackContractTxId = await initContract(
            codeSources[objectTypes.STACK + contractSrcPostfix],
            {
              [svpTags.VAULT_CONTRACT_ID]: this.vaultContract.txId(),
              [svpTags.OBJECT_CONTRACT_TYPE]: objectTypes.STACK
            }, this.wallet.wallet);
          headerPayload[svpTags.OBJECT_CONTRACT_ID] = stackContractTxId;
          this.setContractId(stackContractTxId);
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.STACK,
            "id": stackContractTxId,
          })
          headerPayload[svpTags.COMMAND] = commands.STACK_CREATE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          bodyPayload.name = bodyPayload.file.name;
          break
        case 'STACK_RENAME':
          headerPayload[svpTags.COMMAND] = commands.STACK_UPDATE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          break
        case 'FOLDER_CREATE':
          const folderContractTxId = await initContract(
            codeSources[objectTypes.FOLDER + contractSrcPostfix],
            {
              [svpTags.VAULT_CONTRACT_ID]: this.vaultContract.txId(),
              [svpTags.OBJECT_CONTRACT_TYPE]: objectTypes.FOLDER
            }, this.wallet.wallet);
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.FOLDER,
            "id": folderContractTxId,
          })
          headerPayload[svpTags.OBJECT_CONTRACT_ID] = folderContractTxId;
          this.setContractId(folderContractTxId);
          headerPayload[svpTags.COMMAND] = commands.FOLDER_CREATE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          break
        case 'MEMO_CREATE':
          const memoContractTxId = await initContract(
            codeSources[objectTypes.MEMO + contractSrcPostfix],
            {
              [svpTags.VAULT_CONTRACT_ID]: this.vaultContract.txId(),
              [svpTags.OBJECT_CONTRACT_TYPE]: objectTypes.MEMO
            }, this.wallet.wallet);
          headerPayload[svpTags.OBJECT_CONTRACT_ID] = memoContractTxId;
          this.setContractId(memoContractTxId);
          response.transactions.push({
            "type": "contract-creation",
            "objectType": objectTypes.MEMO,
            "id": memoContractTxId,
          })
          headerPayload[svpTags.COMMAND] = commands.MEMO_CREATE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.MEMO;
          break
        case 'VAULT_ARCHIVE':
          headerPayload[svpTags.COMMAND] = commands.VAULT_ARCHIVE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.VAULT;
          bodyPayload.status = status.ARCHIVED
          break
        case 'VAULT_RESTORE':
          headerPayload[svpTags.COMMAND] = commands.VAULT_RESTORE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.VAULT;
          bodyPayload.status = status.ARCHIVED
          break
        case 'STACK_REVOKE':
          headerPayload[svpTags.COMMAND] = commands.STACK_REVOKE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          bodyPayload.status = status.REVOKED
          break
        case 'STACK_REVOKE':
          headerPayload[svpTags.COMMAND] = commands.STACK_RESTORE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          bodyPayload.status = status.ACTIVE
          break
        case 'STACK_DELETE':
          headerPayload[svpTags.COMMAND] = commands.STACK_DELETE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          bodyPayload.status = status.DELETED
          break
        case 'FOLDER_REVOKE':
          headerPayload[svpTags.COMMAND] = commands.FOLDER_REVOKE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          bodyPayload.status = status.REVOKED
          break
        case 'FOLDER_RESTORE':
          headerPayload[svpTags.COMMAND] = commands.FOLDER_RESTORE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          bodyPayload.status = status.ACTIVE
          break
        case 'FOLDER_DELETE':
          headerPayload[svpTags.COMMAND] = commands.FOLDER_DELETE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          bodyPayload.status = status.DELETED
          break
        case 'STACK_RENAME':
        case 'STACK_UPLOAD_REVISION':
          headerPayload[svpTags.COMMAND] = commands.STACK_UPDATE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          break
        case 'STACK_MOVE':
          headerPayload[svpTags.COMMAND] = commands.STACK_MOVE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.STACK;
          break
        case 'FOLDER_RENAME':
          headerPayload[svpTags.COMMAND] = commands.FOLDER_UPDATE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          break
        case 'FOLDER_MOVE':
          headerPayload[svpTags.COMMAND] = commands.FOLDER_MOVE;
          headerPayload[svpTags.OBJECT_CONTRACT_TYPE] = objectTypes.FOLDER;
          break
        default:
          throw new Error('Unknown action ref: ' + actionRef)
      }

      // build the transaction header
      const address = await this.wallet.getAddress();
      headerPayload[svpTags.SIGNER_ADDRESS] = address;
      headerPayload[svpTags.VAULT_CONTRACT_ID] = this.vaultContract.txId();
      headerPayload[svpTags.MEMBERSHIP_CONTRACT_ID] = this.membershipContract.txId();
      const fullHeader = constructHeader(headerPayload);

      // build & encrypt the transaction body
      const encryptedBody = await this.constructBody(bodyPayload);

      const txInput = await this.signTransaction(fullHeader, encryptedBody);
      const { txId, pstTransfer } = await postContractTransaction(
        headerPayload[svpTags.OBJECT_CONTRACT_ID],
        { function: "write", ...txInput },
        fullHeader,
        this.wallet.wallet
      );
      response.objectId = headerPayload[svpTags.OBJECT_CONTRACT_ID];
      response.vaultId = this.vaultContract.txId();
      response.membershipId = this.membershipContract.txId();
      response.type = headerPayload[svpTags.OBJECT_CONTRACT_TYPE];
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
              const encPrivateKey = await this.keysEncrypter.encryptMemberKey(
                payload[fieldName].privateKey
              );
              encryptedBody.keys = [
                {
                  publicKey: arrayToBase64(payload[fieldName].publicKey),
                  encPrivateKey: encPrivateKey
                }
              ];
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
      const publicKey = await this.wallet.getPublicKey();
      const encodedHeader = jsonToBase64(header);
      const encodedBody = jsonToBase64(body);
      const signature = await this.wallet.sign(`${encodedHeader}${encodedBody}`);
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
  return SVPWrapper;
})();