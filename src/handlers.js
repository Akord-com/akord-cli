const { getContract } = require('./helpers');
const fs = require('fs');
const { arweave, prepareArweaveTransaction, uploadChunksArweaveTransaction } = require("./arweave-helpers");
var path = require("path");
const {
  askForFilePath,
  askForTransactionId,
  askForAccessType,
  askForStackName,
  askForUploadType,
  askForRole
} = require("./inquirers");
const SVPWrapper = require("./wrapper");
const WalletFactory = require('./crypto/wallet/wallet-factory');
const { fromMembershipContract } = require('./crypto/encryption-keys');
const os = require('os');

async function vaultCreateHandler(argv) {
  let user = await loadKeyFile();
  const name = argv.name;
  const termsOfAccess = argv.termsOfAccess;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const svpWrapper = new SVPWrapper(wallet);
  await svpWrapper.dispatch("VAULT_CREATE", {}, { name: name, termsOfAccess: termsOfAccess });
  console.log(`Vault created, vault id: ` + svpWrapper.contractId);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function objectReadHandler(argv) {
  let user = await loadKeyFile();
  const objectId = argv.objectId;
  const state = await getContract(objectId, user.wallet).readState();
  const vaultId = state.state.vaultId ? state.state.vaultId : objectId;
  const membershipState = await getMembership(vaultId, user);
  const vaultContract = getContract(vaultId, user.wallet);

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, vaultContract, getContract(user.membershipContractTxId, user.wallet));
  const decryptedState = await svpWrapper.dataEncrypter.decryptState(state.state);
  console.log(decryptedState);
  process.exit(0);
}

async function loadKeyFile() {
  let user = {};
  try {
    const config = fs.readFileSync(os.homedir() + "/.akord").toString();
    user.wallet = JSON.parse(config);
    user.address = await arweave.wallets.jwkToAddress(user.wallet);
    return user;
  } catch (error) {
    console.log("Oops, something went wrong when loading your wallet: " + error);
    console.log("Make sure that your keyfile is configured: akord configure --help");
    process.exit(0);
  }
}

async function configureHandler(argv) {
  const keyFile = argv.keyFile;
  try {
    const stringKey = fs.readFileSync(keyFile).toString();
    fs.writeFileSync(os.homedir() + "/.akord", stringKey);
  } catch (error) {
    console.log("Oops, something went wrong when configuring your wallet: " + error);
    process.exit(0);
  }
}

async function vaultRenameHandler(argv) {
  let user = await loadKeyFile();
  const vaultId = argv.vaultId;
  const name = argv.name;

  user.contract = getContract(vaultId, user.wallet);
  const membershipState = await getMembership(vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("VAULT_RENAME", { "Object-Contract-Id": vaultId }, { name: name })
  console.log(`Vault successfully updated`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function vaultArchiveHandler(argv) {
  let user = await loadKeyFile();
  const vaultId = argv.vaultId;

  user.contract = getContract(vaultId, user.wallet);
  const membershipState = await getMembership(vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("VAULT_ARCHIVE", { "Object-Contract-Id": vaultId }, {})
  console.log(`Vault successfully updated`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function vaultRestoreHandler(argv) {
  let user = await loadKeyFile();
  const vaultId = argv.vaultId;

  user.contract = getContract(vaultId, user.wallet);
  const membershipState = await getMembership(vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("VAULT_RESTORE", { "Object-Contract-Id": vaultId }, {})
  console.log(`Vault successfully updated`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function stackCreateHandler(argv) {
  let user = await loadKeyFile();
  const vaultId = argv.vaultId;

  user.contract = getContract(vaultId, user.wallet);
  const membershipState = await getMembership(vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const { accessType } = await askForAccessType();

  let file = {};
  if (accessType === 'public') {
    const { uploadType } = await askForUploadType();
    if (uploadType === 'transaction id') {
      const { transactionId } = await askForTransactionId();
      file.resourceTx = transactionId;
    }
  } else {
    const { filePath } = await askForFilePath();
    file = getFileFromPath(filePath);
    const transaction = await prepareArweaveTransaction(file.data, { 'Content-Type': 'image/jpeg' }, user.wallet);
    await uploadChunksArweaveTransaction(transaction);
    file.resourceTx = transaction.id;
  }

  const { name } = await askForStackName();

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const state = await getContract(user.membershipContractTxId, user.wallet).readState();
  const encryptionKeys = fromMembershipContract(state.state);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("STACK_CREATE", {}, { name: name ? name : file.name, file: file });
  console.log(`Stack created, stack id: ` + svpWrapper.contractId);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function stackUploadRevisionHandler(argv) {
  let user = await loadKeyFile();
  const vaultId = argv.vaultId;

  user.contract = getContract(vaultId, user.wallet);
  const membershipState = await getMembership(vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const { accessType } = await askForAccessType();

  let file = {};
  if (accessType === 'public') {
    const { uploadType } = await askForUploadType();
    if (uploadType === 'transaction id') {
      const { transactionId } = await askForTransactionId();
      file.resourceTx = transactionId;
    }
  } else {
    const { filePath } = await askForFilePath();
    file = getFileFromPath(filePath);
    const transaction = await prepareArweaveTransaction(file.data, { 'Content-Type': 'image/jpeg' }, user.wallet);
    await uploadChunksArweaveTransaction(transaction);
    file.resourceTx = transaction.id;
  }

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const state = await getContract(user.membershipContractTxId, user.wallet).readState();
  const encryptionKeys = fromMembershipContract(state.state);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("STACK_UPLOAD_REVISION", {}, { file: file });
  console.log(`Stack successfully updated`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function stackRenameHandler(argv) {
  let user = await loadKeyFile();

  const stackId = argv.stackId;
  const name = argv.name;

  const initialState = await getContract(stackId, user.wallet).readState();

  user.contract = getContract(initialState.state.vaultId, user.wallet);
  const membershipState = await getMembership(initialState.state.vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("STACK_RENAME", { "Object-Contract-Id": stackId }, { name: name })
  console.log(`Stack successfully updated`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function stackRevokeHandler(argv) {
  let user = await loadKeyFile();

  const stackId = argv.stackId;

  const initialState = await getContract(stackId, user.wallet).readState();

  user.contract = getContract(initialState.state.vaultId, user.wallet);
  const membershipState = await getMembership(initialState.state.vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("STACK_REVOKE", { "Object-Contract-Id": stackId }, {})
  console.log(`Stack successfully revoked`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function stackRestoreHandler(argv) {
  let user = await loadKeyFile();

  const stackId = argv.stackId;

  const initialState = await getContract(stackId, user.wallet).readState();

  user.contract = getContract(initialState.state.vaultId, user.wallet);
  const membershipState = await getMembership(initialState.state.vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("STACK_RESTORE", { "Object-Contract-Id": stackId }, {})
  console.log(`Stack successfully restored`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function stackDeleteHandler(argv) {
  let user = await loadKeyFile();

  const stackId = argv.stackId;

  const initialState = await getContract(stackId, user.wallet).readState();

  user.contract = getContract(initialState.state.vaultId, user.wallet);
  const membershipState = await getMembership(initialState.state.vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("STACK_DELETE", { "Object-Contract-Id": stackId }, {})
  console.log(`Stack successfully deleted`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function stackMoveHandler(argv) {
  let user = await loadKeyFile();

  const stackId = argv.stackId;
  const parentFolderId = argv.parentFolderId;

  const initialState = await getContract(stackId, user.wallet).readState();

  user.contract = getContract(initialState.state.vaultId, user.wallet);
  const membershipState = await getMembership(initialState.state.vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("STACK_MOVE", { "Object-Contract-Id": stackId }, { folderId: parentFolderId })
  console.log(`Stack successfully updated`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function memoCreateHandler(argv) {
  let user = await loadKeyFile();

  const vaultId = argv.vaultId;
  const message = argv.message;

  user.contract = getContract(vaultId, user.wallet);
  const membershipState = await getMembership(vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("MEMO_CREATE", {}, { message: message });
  console.log(`Memo created, memo id: ` + svpWrapper.contractId);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function folderCreateHandler(argv) {
  let user = await loadKeyFile();

  const vaultId = argv.vaultId;
  const name = argv.name;
  const parentFolderId = argv.parentFolderId;


  user.contract = getContract(vaultId, user.wallet);
  const membershipState = await getMembership(vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("FOLDER_CREATE", {}, { name: name, folderId: parentFolderId })
  console.log(`Folder created, folder id: ` + svpWrapper.contractId);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function folderRenameHandler(argv) {
  let user = await loadKeyFile();

  const folderId = argv.folderId;
  const name = argv.name;

  const initialState = await getContract(folderId, user.wallet).readState();

  user.contract = getContract(initialState.state.vaultId, user.wallet);
  const membershipState = await getMembership(initialState.state.vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("FOLDER_RENAME", { "Object-Contract-Id": folderId }, { name: name })
  console.log(`Folder successfully updated`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function folderMoveHandler(argv) {
  let user = await loadKeyFile();

  const folderId = argv.folderId;
  const parentFolderId = argv.parentFolderId;

  const initialState = await getContract(folderId, user.wallet).readState();

  user.contract = getContract(initialState.state.vaultId, user.wallet);
  const membershipState = await getMembership(initialState.state.vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("FOLDER_MOVE", { "Object-Contract-Id": folderId }, { folderId: parentFolderId })
  console.log(`Folder successfully updated.`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function folderRevokeHandler(argv) {
  let user = await loadKeyFile();

  const folderId = argv.folderId;

  const initialState = await getContract(folderId, user.wallet).readState();

  user.contract = getContract(initialState.state.vaultId, user.wallet);
  const membershipState = await getMembership(initialState.state.vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("FOLDER_REVOKE", { "Object-Contract-Id": folderId }, {})
  console.log(`Folder successfully revoked.`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function folderRestoreHandler(argv) {
  let user = await loadKeyFile();

  const folderId = argv.folderId;

  const initialState = await getContract(folderId, user.wallet).readState();

  user.contract = getContract(initialState.state.vaultId, user.wallet);
  const membershipState = await getMembership(initialState.state.vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("FOLDER_RESTORE", { "Object-Contract-Id": folderId }, {});
  console.log(`Folder successfully restored.`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function folderDeleteHandler(argv) {
  let user = await loadKeyFile();
  const folderId = argv.folderId;

  const initialState = await getContract(folderId, user.wallet).readState();

  user.contract = getContract(initialState.state.vaultId, user.wallet);
  const membershipState = await getMembership(initialState.state.vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("FOLDER_DELETE", { "Object-Contract-Id": folderId }, {})
  console.log(`Folder successfully deleted.`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

function getFileFromPath(filePath) {
  let file = {};
  if (!fs.existsSync(filePath)) {
    console.error(`Could not find a file in your filesystem`);
    process.exit(0);
  }
  const stats = fs.statSync(filePath);
  file.size = stats.size;
  file.data = fs.readFileSync(filePath);
  file.name = path.basename(filePath);
  return file;
}

async function membershipInviteHandler(argv) {
  let user = await loadKeyFile();

  const vaultId = argv.vaultId;
  const address = argv.address;

  const { role } = await askForRole();

  user.contract = getContract(vaultId, user.wallet);
  const membershipState = await getMembership(vaultId, user);
  user.membershipContractTxId = membershipState.id;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(membershipState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("MEMBERSHIP_INVITE", {}, { address: address, role: role })
  console.log(`Membership created, member id: ` + svpWrapper.contractId);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function membershipAcceptHandler(argv) {
  let user = await loadKeyFile();

  const membershipId = argv.membershipId;

  const initialState = await getContract(membershipId, user.wallet).readState();
  user.contract = getContract(initialState.state.vaultId, user.wallet);
  user.membershipContractTxId = membershipId;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(initialState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("MEMBERSHIP_ACCEPT", { "Object-Contract-Id": membershipId }, {})
  console.log(`Membership successfully updated.`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function membershipRejectHandler(argv) {
  let user = await loadKeyFile();

  const membershipId = argv.membershipId;

  const initialState = await getContract(membershipId, user.wallet).readState();
  user.contract = getContract(initialState.state.vaultId, user.wallet);
  user.membershipContractTxId = membershipId;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(initialState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("MEMBERSHIP_REJECT", { "Object-Contract-Id": membershipId }, {});
  console.log(`Membership successfully updated.`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function membershipRevokeHandler(argv) {
  let user = await loadKeyFile();

  const membershipId = argv.membershipId;

  const initialState = await getContract(membershipId, user.wallet).readState();
  user.contract = getContract(initialState.state.vaultId, user.wallet);
  user.membershipContractTxId = membershipId;

  const wallet = new WalletFactory("ARWEAVE", user.wallet).walletInstance();
  const encryptionKeys = fromMembershipContract(initialState);
  const svpWrapper = new SVPWrapper(wallet, encryptionKeys, user.contract, getContract(user.membershipContractTxId, user.wallet));
  await svpWrapper.dispatch("MEMBERSHIP_REVOKE", { "Object-Contract-Id": membershipId }, {});
  console.log(`Membership successfully revoked.`);
  console.log(`Transaction was posted, it might take few minutes for the transaction to be confirmed by the network: `
    + svpWrapper.transactionId);
  process.exit(0);
}

async function getMembership(vaultId, user) {
  const vaultState = await getContract(vaultId, user.wallet).readState();
  for (let membershipId of vaultState.state.memberships) {
    const memberState = await getContract(membershipId, user.wallet).readState();
    if (memberState.state.address === user.address) {
      return memberState.state;
    }
  }
}

module.exports = {
  configureHandler,
  vaultCreateHandler,
  vaultRenameHandler,
  vaultArchiveHandler,
  vaultRestoreHandler,
  memoCreateHandler,
  stackCreateHandler,
  stackUploadRevisionHandler,
  stackRenameHandler,
  stackRevokeHandler,
  stackRestoreHandler,
  stackMoveHandler,
  stackDeleteHandler,
  folderCreateHandler,
  folderRenameHandler,
  folderMoveHandler,
  folderRevokeHandler,
  folderRestoreHandler,
  folderDeleteHandler,
  membershipInviteHandler,
  membershipRevokeHandler,
  membershipAcceptHandler,
  membershipRejectHandler,
  objectReadHandler
}