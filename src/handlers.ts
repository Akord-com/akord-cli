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
import { ClientConfig } from "./client-config";
import ApiAuthenticator from "./api-authenticator";
import { randomUUID } from 'crypto';

export function initInstance(config: ClientConfig, wallet: Wallet, jwtToken: string) {
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

async function configureHandler(argv: { env: string }) {
  const env = argv.env;
  fs.writeFileSync(os.homedir() + "/.akord-cli-config", env);
  console.log("The CLI was configured to use the " + env + " network.");
}

async function walletImportHandler(argv: { keyFile: string }) {
  const keyFile = argv.keyFile;
  try {
    const stringKey = fs.readFileSync(keyFile).toString();
    storeWallet(stringKey);
  } catch (error) {
    console.log("Oops, something went wrong when configuring your wallet: " + error);
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
  const apiAuthenticator = new ApiAuthenticator(config);
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

  const apiAuthenticator = new ApiAuthenticator(config);
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

async function walletGenerateHandler() {
  // console.log("Please be patient, generating the wallet may take a while");
  // const wallet = await MnemonicWallet.create();
  // storeWallet(JSON.stringify({
  //   "jwk": wallet.wallet,
  //   "mnemonic": wallet.backupPhrase
  // }));
  // const address = await wallet.getAddress();
  // const publicKey = wallet.publicKey();
  // const signingPublicKey = wallet.signingPublicKey();
  // console.log("Your wallet was generated & stored successfully at: ~/.akord");
  // console.log("Your wallet address: " + address);
  // console.log("Your wallet public key: " + publicKey);
  // console.log("Your wallet signing public key: " + signingPublicKey);
  // console.log("The seed phrase to recover the wallet: " + wallet.backupPhrase);
  // console.log("Please keep it somewhere safe.");
  // process.exit(0);
};

async function walletRecoverHandler(argv: { mnemonic: string }) {
  const mnemonic = argv.mnemonic;
  console.log("Please be patient, recovering the wallet may take a while");
  const wallet = await AkordWallet.importFromBackupPhrase(mnemonic);
  storeWallet(JSON.stringify({
    "mnemonic": wallet.backupPhrase
  }));
  const address = await wallet.getAddress();
  const publicKey = await wallet.publicKey();
  const signingPublicKey = await wallet.signingPublicKey();
  console.log("Your wallet address: " + address);
  console.log("Your wallet public key: " + publicKey);
  console.log("Your wallet signing public key: " + signingPublicKey);
  process.exit(0);
};

async function vaultCreateHandler(argv: {
  name: string,
  termsOfAccess: string
}) {
  const { wallet, jwtToken } = await loadCredentials();
  const name = argv.name;
  const termsOfAccess = argv.termsOfAccess;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.vaultCreate(name, termsOfAccess);
  displayResponse(response);
  process.exit(0);
}

function displayResponse(response: any) {
  console.log(response);
  console.log("Your transaction has been successfully commited. You can view it in the explorer by visiting the link below:");
  console.log("https://sonar.warp.cc/#/app/interaction/" + response.transactions[response.transactions.length -1].id);
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
  const response = await akord.vaultRename(vaultId, name);
  displayResponse(response);
  process.exit(0);
}

async function vaultArchiveHandler(argv: { vaultId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.vaultArchive(vaultId);
  displayResponse(response);
  process.exit(0);
}

async function vaultRestoreHandler(argv: { vaultId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.vaultRestore(vaultId);
  displayResponse(response);
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
  const response = await akord.stackCreate(vaultId, file, name, parentId);
  displayResponse(response);
  process.exit(0);
}

async function stackUploadRevisionHandler(argv: { stackId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;
  const file = await _getFile(argv);

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.stackUploadRevision(stackId, file);
  displayResponse(response);
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
  const response = await akord.stackRename(stackId, name);
  displayResponse(response);
  process.exit(0);
}

async function stackRevokeHandler(argv: { stackId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.stackRevoke(stackId);
  displayResponse(response);
  process.exit(0);
}

async function stackRestoreHandler(argv: { stackId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.stackRestore(stackId);
  displayResponse(response);
  process.exit(0);
}

async function stackDeleteHandler(argv: { stackId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.stackDelete(stackId);
  displayResponse(response);
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
  const response = await akord.stackMove(stackId, parentId);
  displayResponse(response);
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
  const response = await akord.memoCreate(vaultId, message);
  displayResponse(response);
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
  const response = await akord.folderCreate(vaultId, name, parentId);
  displayResponse(response);
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
  const response = await akord.folderRename(folderId, name);
  displayResponse(response);
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
  const response = await akord.folderMove(folderId, parentId);
  displayResponse(response);
  process.exit(0);
}

async function folderRevokeHandler(argv: { folderId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.folderId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.folderRevoke(folderId);
  displayResponse(response);
  process.exit(0);
}

async function folderRestoreHandler(argv: { folderId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.folderId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.folderRestore(folderId);
  displayResponse(response);
  process.exit(0);
}

async function folderDeleteHandler(argv: { folderId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.folderId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.folderDelete(folderId);
  displayResponse(response);
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
  address: string,
  role?: string,
}) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;
  const address = argv.address;

  const role = argv.role || (await askForRole()).role;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.membershipInvite(vaultId, address, role);
  displayResponse(response);
  process.exit(0);
}

async function membershipAcceptHandler(argv: { membershipId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const membershipId = argv.membershipId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.membershipAccept(membershipId);
  displayResponse(response);
  process.exit(0);
}

async function membershipRejectHandler(argv: { membershipId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const membershipId = argv.membershipId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.membershipReject(membershipId);
  displayResponse(response);
  process.exit(0);
}

async function membershipRevokeHandler(argv: { membershipId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const membershipId = argv.membershipId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.membershipRevoke(membershipId);
  displayResponse(response);
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
  displayResponse(response);
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

async function fileGetHandler(argv: { fileUrl: string, vaultId: string, filePath: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const fileUrl = argv.fileUrl;
  const vaultId = argv.vaultId;
  let filePath = argv.filePath;

  if (filePath && fs.existsSync(filePath)) {
    console.error("File within the given path already exist, please choose a different path and try again.");
    process.exit(0);
  }

  if (!filePath) {
    filePath = process.cwd() + "/" + randomUUID();
  }

  const akord = await Akord.init(config, wallet, jwtToken);
  const file = await akord.getFile(fileUrl, vaultId);
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
  walletGenerateHandler,
  walletImportHandler,
  walletRecoverHandler,
  configureHandler,
  vaultListHandler,
  vaultShowHandler,
  stackListHandler,
  stackShowHandler,
  folderListHandler,
  folderShowHandler,
  fileGetHandler
}