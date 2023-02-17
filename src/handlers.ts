import fs from 'fs';
import path from "path";
import {
  askForFilePath,
  askForTransactionId,
  askForStackName,
  askForUploadType,
  askForRole,
  askForPassword,
  askForCode,
  askForWaiveOfWithdrawalRight,
  askForTermsOfServiceAndPrivacyPolicy
} from "./inquirers";
import os from 'os';
import { Akord } from "@akord/akord-js"
import { WalletType, Wallet, WalletFactory, AkordWallet } from "@akord/crypto";
import { CipherGCMTypes, createCipheriv, createDecipheriv, pbkdf2 as pbkdf2Cb, randomBytes, randomUUID } from "crypto";
import figlet from "figlet";
import { promisify } from "util";
import * as keytar from "keytar";

const pbkdf2 = promisify(pbkdf2Cb);

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

type StoredWallet = {
  mnemonic: string;
  jwtToken: string;
};

type BasePBKDF2Settings = {
  algorithm: string;
  iterations: number;
};

type PBKDF2Settings = BasePBKDF2Settings & {
  salt: Buffer;
};

type StoredPBKDF2Settings = BasePBKDF2Settings & {
  salt: string;
};


type StoredEncryptedWallet = {
  encryptedWallet: string;
  pbkdf2: StoredPBKDF2Settings;
  aes: {
    algorithm: CipherGCMTypes;
    iv: string;
    authTag: string;
  };
};

function deriveKey(password: string, pbkdf2Settings: PBKDF2Settings, length: number = 32): Promise<Buffer> {
  return pbkdf2(
    password,
    pbkdf2Settings.salt,
    pbkdf2Settings.iterations,
    length,
    pbkdf2Settings.algorithm
  );
}

async function encryptWallet(password: string, storedWallet: StoredWallet): Promise<StoredEncryptedWallet> {
  const toEncrypt = JSON.stringify(storedWallet);

  const pbkdf2Settings = {
    algorithm: "sha256",
    salt: randomBytes(12),
    iterations: 100_000,
  };
  const key = await deriveKey(password, pbkdf2Settings);

  const iv = randomBytes(16);
  const aesAlgorithm = "aes-256-gcm";
  const cipher = createCipheriv(aesAlgorithm, key, iv);

  let encryptedWallet = cipher.update(toEncrypt, "utf8", "base64");
  encryptedWallet += cipher.final("base64")
  const authTag = cipher.getAuthTag().toString("base64");
  return {
    encryptedWallet,
    pbkdf2: { ...pbkdf2Settings, salt: pbkdf2Settings.salt.toString("base64") },
    aes: { algorithm: aesAlgorithm, iv: iv.toString("base64"), authTag },
  };
}

async function decryptWallet(password: string, storedEncryptedWallet: StoredEncryptedWallet): Promise<StoredEncryptedWallet> {
  const key = await pbkdf2(
    password,
    Buffer.from(storedEncryptedWallet.pbkdf2.salt, "base64"),
    storedEncryptedWallet.pbkdf2.iterations,
    32,
    storedEncryptedWallet.pbkdf2.algorithm
  );

  const decipher = createDecipheriv(
    storedEncryptedWallet.aes.algorithm,
    key,
    Buffer.from(storedEncryptedWallet.aes.iv, "base64")
  )
  let decryptedWallet = decipher.update(storedEncryptedWallet.encryptedWallet, "base64", "utf8");
  decryptedWallet += decipher.final("base64");
  return JSON.parse(decryptedWallet);
}


async function loginHandler(argv: {
  email: string,
  password?: string
}) {
  console.log(figlet.textSync("Akord", { horizontalLayout: "full" }));
  const email = argv.email;
  let password = argv.password;

  if (!password) {
    password = (await askForPassword()).password;
  }
  const { wallet, jwtToken } = await Akord.auth.signIn(email, password);
  const encryptedWallet = await encryptWallet(password, { mnemonic: wallet.backupPhrase, jwtToken });
  storeWallet(JSON.stringify(encryptedWallet));

  console.log("Your wallet address: " + await wallet.getAddress());
  console.log("Your wallet public key: " + await wallet.publicKey());
  console.log("Your wallet signing public key: " + await wallet.signingPublicKey());
  process.exit(0);
}

async function signupHandler(argv: {
  email: string,
  password?: string
}) {
  console.log(
    figlet.textSync('Akord', { horizontalLayout: 'full' })
  );

  const email = argv.email;
  let password = argv.password;

  if (!password) {
    password = (await askForPassword()).password;
  }

  if (!(await askForTermsOfServiceAndPrivacyPolicy()).terms) {
    process.exit(0);
  }

  if (!(await askForWaiveOfWithdrawalRight()).withdrawal) {
    process.exit(0);
  }

  await Akord.auth.signUp(email, password, { clientType: "CLI" });

  console.log("Your account was successfully created. We have sent you the verification code.");
  const code = (await askForCode()).code;
  await Akord.auth.verifyAccount(email, code);
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

  const akord = await Akord.init(wallet, jwtToken, config);
  const { vaultId, transactionId } = await akord.vault.create(name, termsOfAccess);
  console.log("Vault successfully created with id: " + vaultId);
  displayResponse(transactionId);
  process.exit(0);
}

function displayResponse(transactionId: string) {
  console.log("Your transaction has been successfully commited. You can view it in the explorer by visiting the link below:");
  console.log("https://sonar.warp.cc/#/app/interaction/" + transactionId);
}

async function retrievePassword(): Promise<string> {
  const service = "akord";
  const account = "default";

  let password: string;

  try {
    password = await keytar.getPassword(service, account);
  } catch (err) {}

  if (password) {
    return password;
  }

  password = (await askForPassword()).password;

  try {
    await keytar.setPassword(service, account, password);
  } catch (err) {}

  return password;
}

async function readEncryptedConfig(config: StoredEncryptedWallet): Promise<StoredWallet> {
  const password = await retrievePassword();
  const iv = Buffer.from(config.aes.iv, "base64");
  const pbkdf2Settings = { ...config.pbkdf2, salt: Buffer.from(config.pbkdf2.salt, "base64") };
  const key = await deriveKey(password, pbkdf2Settings);
  const decipher = createDecipheriv(config.aes.algorithm, key, iv);
  decipher.setAuthTag(Buffer.from(config.aes.authTag, "base64"));
  let rawConfig = decipher.update(config.encryptedWallet, "base64", "utf8");
  rawConfig += decipher.final("utf8");
  return JSON.parse(rawConfig);
}

async function loadCredentials(): Promise<{ wallet: Wallet, jwtToken: string }> {
  let wallet = {} as Wallet;
  let jwtToken = null;
  try {
    let config = JSON.parse(fs.readFileSync(os.homedir() + "/.akord").toString());

    if (config.encryptedWallet) {
      config = await readEncryptedConfig(config);
    }

    if (config.mnemonic) {
      wallet = new WalletFactory(WalletType.Akord, config.mnemonic).walletInstance();
      await (<AkordWallet>wallet).deriveKeys();
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

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.vault.rename(vaultId, name);
  displayResponse(transactionId);
  process.exit(0);
}

async function vaultArchiveHandler(argv: { vaultId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.vault.archive(vaultId);
  displayResponse(transactionId);
  process.exit(0);
}

async function vaultRestoreHandler(argv: { vaultId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.vault.restore(vaultId);
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

  const akord = await Akord.init(wallet, jwtToken, config);
  const { stackId, transactionId } = await akord.stack.create(vaultId, file, name, parentId);
  console.log("Stack successfully created with id: " + stackId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackImportHandler(argv: {
  vaultId: string,
  fileTxId: string,
  parentId?: string
}) {
  const { wallet, jwtToken } = await loadCredentials();
  const { vaultId, fileTxId, parentId } = argv;

  const akord = await Akord.init(wallet, jwtToken, config);
  const { stackId, transactionId } = await akord.stack.import(vaultId, fileTxId, parentId);
  console.log("Stack successfully created with id: " + stackId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackUploadRevisionHandler(argv: { stackId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;
  const file = await _getFile(argv);

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.stack.uploadRevision(stackId, file);
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

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.stack.rename(stackId, name);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackRevokeHandler(argv: { stackId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.stack.revoke(stackId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackRestoreHandler(argv: { stackId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.stack.restore(stackId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackDeleteHandler(argv: { stackId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.stack.delete(stackId);
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

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.stack.move(stackId, parentId);
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

  const akord = await Akord.init(wallet, jwtToken, config);
  const { memoId, transactionId } = await akord.memo.create(vaultId, message);
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

  const akord = await Akord.init(wallet, jwtToken, config);
  const { folderId, transactionId } = await akord.folder.create(vaultId, name, parentId);
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

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.folder.rename(folderId, name);
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

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.folder.move(folderId, parentId);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderRevokeHandler(argv: { folderId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.folderId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.folder.revoke(folderId);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderRestoreHandler(argv: { folderId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.folderId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.folder.restore(folderId);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderDeleteHandler(argv: { folderId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.folderId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.folder.delete(folderId);
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

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.membership.invite(vaultId, email, role);
  displayResponse(transactionId);
  process.exit(0);
}

async function membershipAcceptHandler(argv: { membershipId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const membershipId = argv.membershipId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.membership.accept(membershipId);
  displayResponse(transactionId);
  process.exit(0);
}

async function membershipRejectHandler(argv: { membershipId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const membershipId = argv.membershipId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.membership.reject(membershipId);
  displayResponse(transactionId);
  process.exit(0);
}

async function membershipRevokeHandler(argv: { membershipId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const membershipId = argv.membershipId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const { transactionId } = await akord.membership.revoke(membershipId);
  displayResponse(transactionId);
  process.exit(0);
}

async function vaultListHandler() {
  const { wallet, jwtToken } = await loadCredentials();

  const akord = await Akord.init(wallet, jwtToken, config);
  const response = await akord.vault.list();
  console.table(response);
  process.exit(0);
}

async function vaultGetHandler(argv: { vaultId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const response = await akord.vault.get(vaultId);
  console.log(response);
  process.exit(0);
}

async function stackListHandler(argv: { vaultId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const response = await akord.stack.listAll(vaultId);
  console.table(response);
  process.exit(0);
}

async function folderListHandler(argv: { vaultId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const response = await akord.folder.listAll(vaultId);
  console.table(response);
  process.exit(0);
}

async function folderGetHandler(argv: { folderId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.folderId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const response = await akord.folder.get(folderId);
  console.log(response);
  process.exit(0);
}

async function stackGetHandler(argv: { stackId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const response = await akord.stack.get(stackId);
  console.log(response);
  process.exit(0);
}

async function membershipListHandler(argv: { vaultId: string }) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(wallet, jwtToken, config);
  const response = await akord.membership.listAll(vaultId);
  const members = response.map((membership: any) => {
    return { 
      id: membership.id,
      status: membership.status,
      role: membership.role,
      email: membership.memberDetails.email,
    }
  })
  console.table(members);
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
  const akord = await Akord.init(wallet, jwtToken, config);
  const { name, data } = await akord.stack.getVersion(stackId, version);
  if (!filePath) {
    filePath = process.cwd() + "/" + name;
    if (fs.existsSync(filePath)) {
      filePath = process.cwd() + "/" + randomUUID() + "-" + name;
    }
  }
  fs.writeFileSync(filePath, Buffer.from(data));
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
  stackImportHandler,
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
  vaultGetHandler,
  stackListHandler,
  stackGetHandler,
  folderListHandler,
  folderGetHandler,
  membershipListHandler,
  stackDownloadHandler
}
