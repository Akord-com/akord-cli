import fs from 'fs';
import path from "path";
import {
  askForFilePath,
  askForTransactionId,
  askForStackName,
  askForUploadType,
  askForRole,
  askForPassword,
  askForCode
} from "./inquirers";
import os from 'os';
import Akord from "@akord/akord-js"
import { WalletType, Wallet, AkordWallet, WalletFactory } from "@akord/crypto"
import ApiAuthenticator from "./api-authenticator";
import { randomUUID } from 'crypto';

export function initInstance(config: any, wallet: Wallet, jwtToken: string) {
  return new Akord(config, wallet, jwtToken);
}

let config = {};

function storeWallet(walletData) {
  try {
    fs.writeFileSync(os.homedir() + "/.akord", walletData);
    console.log("Your wallet was stored successfully at: ~/.akord");
  } catch (error) {
    console.log("Oops, something went wrong when storing your wallet: " + error);
    process.exit(0);
  }
}

async function loginHandler(argv: {
  email: string,
  password?: string
}) {
  const email = argv.email;
  let password = argv.password;

  if (!password) {
    password = (await askForPassword()).password;
  }
  const apiAuthenticator = new ApiAuthenticator();
  const jwtToken = await apiAuthenticator.getJWTToken(email, password);
  const userAttributes = await apiAuthenticator.getUserAttributes(email, password);
  const wallet = await AkordWallet.importFromEncBackupPhrase(password, userAttributes["custom:encBackupPhrase"]);

  storeWallet(JSON.stringify({
    "mnemonic": wallet.backupPhrase,
    "jwtToken": jwtToken
  }));
  const address = await wallet.getAddress();
  const publicKey = await wallet.publicKey();
  const signingPublicKey = await wallet.signingPublicKey();
  console.log("Your wallet address: " + address);
  console.log("Your wallet public key: " + publicKey);
  console.log("Your wallet signing public key: " + signingPublicKey);
  process.exit(0);
}

async function signupHandler(argv: {
  email: string,
  password?: string
}) {
  const email = argv.email;
  let password = argv.password;

  if (!password) {
    password = (await askForPassword()).password;
  }

  const wallet = await AkordWallet.create(password);

  const apiAuthenticator = new ApiAuthenticator();
  await apiAuthenticator.signup(email, password, {
    email,
    "custom:encBackupPhrase": wallet.encBackupPhrase,
    "custom:publicKey": await wallet.publicKey(),
    "custom:publicSigningKey": await wallet.signingPublicKey(),
    "custom:mode": "dark",
    "custom:notifications": "true",
  });
  console.log("Your account was successfully created. We have sent you the verification code.");
  const code = (await askForCode()).code;
  await apiAuthenticator.verifyAccount(email, code);
  console.log("Your email was verified! You can now login and use the Akord CLI");
  process.exit(0);
}

async function vaultCreateHandler(argv: {
  name: string,
  termsOfAccess: string
}) {
  const { wallet, jwtToken } = await loadCredentials();
  const name = argv.name;
  const termsOfAccess = argv.termsOfAccess;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { vaultId, transactionId } = await akord.vaultCreate(name, termsOfAccess);
  console.log("Vault successfully created with id: " + vaultId);
  displayResponse(transactionId);
  process.exit(0);
}

function displayResponse(transactionId: string) {
  console.log("Your transaction has been successfully commited. You can view it in the explorer by visiting the link below:");
  console.log("https://sonar.warp.cc/#/app/interaction/" + transactionId);
}

async function loadCredentials(): Promise<{ wallet: Wallet, jwtToken: string }> {
  let wallet = {} as Wallet;
  let jwtToken = null;
  try {
    const config = JSON.parse(fs.readFileSync(os.homedir() + "/.akord").toString());
    if (config.mnemonic) {
      wallet = new WalletFactory(WalletType.Akord, config.mnemonic).walletInstance();
      await (<any>wallet).deriveKeys();
      jwtToken = config.jwtToken
    } else {
      wallet = new WalletFactory(WalletType.Arweave, config.jwk).walletInstance();
    }
    return { wallet, jwtToken };
  } catch (error) {
    console.log("Oops, something went wrong when loading your wallet: " + error);
    console.log("Make sure that your keyfile is configured: akord wallet:configure --help");
    process.exit(0);
  }
}

async function vaultRenameHandler(argv: {
  vaultId: string,
  name: string
}) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;
  const name = argv.name;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.vaultRename(vaultId, name);
  displayResponse(transactionId);
  process.exit(0);
}

async function vaultArchiveHandler(argv: { vaultId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.vaultArchive(vaultId);
  displayResponse(transactionId);
  process.exit(0);
}

async function vaultRestoreHandler(argv: { vaultId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.vaultRestore(vaultId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackCreateHandler(argv: {
  vaultId: string,
  parentId?: string,
  name: string
}) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId
  const parentId = argv.parentId
  const file = <any>(await _getFile(argv));
  const name = argv.name || file.name || (await askForStackName(file.name)).name;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { stackId, transactionId } = await akord.stackCreate(vaultId, file, name, parentId);
  console.log("Stack successfully created with id: " + stackId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackUploadRevisionHandler(argv: { stackId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;
  const file = await _getFile(argv);

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.stackUploadRevision(stackId, file);
  displayResponse(transactionId);
  process.exit(0);
}

async function _getFile(argv: any) {
  let file = <any>{};
  if (argv.public) {
    if (argv.filePath) {
      file = getFileFromPath(argv.filePath);
    } else if (argv.transactionId) {
      file.resourceTx = argv.transactionId;
    } else {
      const { uploadType } = await askForUploadType();
      if (uploadType === 'transaction id') {
        const { transactionId } = await askForTransactionId();
        file.resourceTx = transactionId;
      } else {
        const { filePath } = await askForFilePath();
        file = getFileFromPath(filePath);
      }
    }
    file.public = true
  } else {
    const filePath = argv.filePath || (await askForFilePath()).filePath;
    file = getFileFromPath(filePath);
  }
  return file;
}

async function stackRenameHandler(argv: {
  stackId: string,
  name: string
}) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;
  const name = argv.name;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.stackRename(stackId, name);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackRevokeHandler(argv: { stackId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.stackRevoke(stackId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackRestoreHandler(argv: { stackId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.stackRestore(stackId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackDeleteHandler(argv: { stackId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.stackDelete(stackId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackMoveHandler(argv: {
  stackId: string,
  parentId?: string
}) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;
  const parentId = argv.parentId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.stackMove(stackId, parentId);
  displayResponse(transactionId);
  process.exit(0);
}

async function memoCreateHandler(argv: {
  vaultId: string,
  message: string
}) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;
  const message = argv.message;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { memoId, transactionId } = await akord.memoCreate(vaultId, message);
  console.log("Memo successfully created with id: " + memoId);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderCreateHandler(argv: {
  vaultId: string,
  parentId?: string,
  name: string
}) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;
  const parentId = argv.parentId;
  const name = argv.name;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { folderId, transactionId } = await akord.folderCreate(vaultId, name, parentId);
  console.log("Folder successfully created with id: " + folderId);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderRenameHandler(argv: {
  folderId: string,
  name: string
}) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.folderId;
  const name = argv.name;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.folderRename(folderId, name);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderMoveHandler(argv: {
  folderId: string,
  parentId?: string
}) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.folderId;
  const parentId = argv.parentId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.folderMove(folderId, parentId);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderRevokeHandler(argv: { folderId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.folderId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.folderRevoke(folderId);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderRestoreHandler(argv: { folderId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.folderId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.folderRestore(folderId);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderDeleteHandler(argv: { folderId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.folderId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.folderDelete(folderId);
  displayResponse(transactionId);
  process.exit(0);
}

function getFileFromPath(filePath: string) {
  let file = <any>{};
  if (!fs.existsSync(filePath)) {
    console.error("Could not find a file in your filesystem: " + filePath);
    process.exit(0);
  }
  const stats = fs.statSync(filePath);
  file.size = stats.size;
  file.data = fs.readFileSync(filePath);
  file.name = path.basename(filePath);
  return file;
}

async function membershipInviteHandler(argv: {
  vaultId: string,
  email: string,
  role?: string,
}) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;
  const email = argv.email;

  const role = argv.role || (await askForRole()).role;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.membershipInvite(vaultId, email, role);
  displayResponse(transactionId);
  process.exit(0);
}

async function membershipAcceptHandler(argv: { membershipId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const membershipId = argv.membershipId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.membershipAccept(membershipId);
  displayResponse(transactionId);
  process.exit(0);
}

async function membershipRejectHandler(argv: { membershipId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const membershipId = argv.membershipId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.membershipReject(membershipId);
  displayResponse(transactionId);
  process.exit(0);
}

async function membershipRevokeHandler(argv: { membershipId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const membershipId = argv.membershipId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const { transactionId } = await akord.membershipRevoke(membershipId);
  displayResponse(transactionId);
  process.exit(0);
}

async function vaultListHandler() {
  const { wallet, jwtToken } = await loadCredentials();

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.getVaults();
  console.table(response);
  process.exit(0);
}

async function vaultShowHandler(argv: { vaultId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.decryptNode(vaultId, "Vault", vaultId);
  console.log(response);
  process.exit(0);
}

async function stackListHandler(argv: { vaultId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.getNodes(vaultId, "Stack");
  console.table(response);
  process.exit(0);
}

async function folderListHandler(argv: { vaultId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.getNodes(vaultId, "Folder");
  console.table(response);
  process.exit(0);
}

async function folderShowHandler(argv: { folderId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.folderId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.decryptNode(folderId, "Folder");
  console.log(response);
  process.exit(0);
}

async function stackShowHandler(argv: { stackId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.decryptNode(stackId, "Stack");
  console.log(response);
  process.exit(0);
}

async function stackDownloadHandler(argv: { stackId: string, fileVersion: string, filePath: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;
  const version = argv.fileVersion;
  let filePath = argv.filePath;

  if (filePath && fs.existsSync(filePath)) {
    console.error("File within the given path already exist, please choose a different path and try again.");
    process.exit(0);
  }

  if (!filePath) {
    filePath = process.cwd() + "/" + randomUUID();
  }

  const akord = await Akord.init(config, wallet, jwtToken);
  const file = await akord.getStackFile(stackId, version);
  fs.writeFileSync(filePath, Buffer.from(file));
  console.error("The file was successfully downloaded, decrypted & stored in: " + filePath);
  process.exit(0);
}

export {
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
  loginHandler,
  signupHandler,
  vaultListHandler,
  vaultShowHandler,
  stackListHandler,
  stackShowHandler,
  folderListHandler,
  folderShowHandler,
  stackDownloadHandler
}