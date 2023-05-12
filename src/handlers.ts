import figlet from "figlet";
import fs from 'fs';
import path from "path";
import clc from 'cli-color'
import ora from 'ora';
import os from 'os';
import { promisify } from "util";
import * as keytar from "keytar";
import { Akord, Auth } from "@akord/akord-js"
import { FileStorage } from "@akord/akord-auth"
import { AkordWallet } from "@akord/crypto";
import { CipherGCMTypes, createCipheriv, createDecipheriv, pbkdf2 as pbkdf2Cb, randomBytes, randomUUID } from "crypto";
import { sync } from './sync';
import formatStorage from './sync/storage/formatter';
import { AkordStorage } from './sync/storage/impl/akord-storage';
import {
  askForFilePath,
  askForTransactionId,
  askForStackName,
  askForUploadType,
  askForRole,
  askForPassword,
  askForCode,
  askForWaiveOfWithdrawalRight,
  askForTermsOfServiceAndPrivacyPolicy,
  askForConfirmation
} from "./inquirers";
import { StorageDiff } from "./sync/storage/types";
import { Argv } from "yargs";
import { logger } from "./logger";

const CONFIG_STORE_PATH = `${os.homedir()}/.akord`
const CREDENTIALS_STORE_PATH = `${CONFIG_STORE_PATH}/credentials`
const storage = new FileStorage(CREDENTIALS_STORE_PATH)
const pbkdf2 = promisify(pbkdf2Cb);
let spinner: ora.Ora = ora()

configure();

function configure() {
  Auth.configure({ storage: storage })
  if (!fs.existsSync(CONFIG_STORE_PATH)) {
    fs.mkdirSync(CONFIG_STORE_PATH, { recursive: true });
  } else {
    if (fs.statSync(CONFIG_STORE_PATH).isFile()) {
      fs.unlinkSync(CONFIG_STORE_PATH)
      fs.mkdirSync(CONFIG_STORE_PATH, { recursive: true });
    }
  }
}

function storeWallet(walletData) {
  try {
    storage.setItem("wallet", walletData);
    spinner.info("Your wallet was stored at: ~/.akord/credentials");
  } catch (error) {
    spinner.fail("Oops, something went wrong when storing your wallet: " + error);
    process.exit(0);
  }
}

type StoredWallet = {
  mnemonic: string;
  account: string;
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
  account: string;
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
    account: storedWallet.account,
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

function displayResponse(transactionId: string) {
  if (spinner && spinner.isSpinning) {
    spinner.succeed()
  }
  spinner.succeed("Your transaction has been successfully commited. You can view it in the explorer by visiting the link below:");
  spinner.info("https://sonar.warp.cc/#/app/interaction/" + transactionId);
}

function displayError(msg: string, err: Error, yargs: Argv) {
  if (spinner && spinner.isSpinning) {
    spinner.fail()
  }
  if (msg) {
    spinner.fail(msg)
  }
  else if (err) {
    spinner.fail(err.message);
    logger.error(err)
  } else {
    spinner.fail("Something went wrong. Log is available under: " + CONFIG_STORE_PATH);
  }
  process.exit(1);
}

async function loginHandler(argv: {
  email: string,
}) {
  console.log(figlet.textSync("Akord", { horizontalLayout: "full" }));
  const email = argv.email;
  const password = await retrievePassword(false, email);
  spinner.start("Signing in...")
  const { wallet } = await Auth.signIn(email, password);
  const encryptedWallet = await encryptWallet(password, { mnemonic: wallet.backupPhrase, account: email });
  storeWallet(JSON.stringify(encryptedWallet));

  spinner.info("Your wallet address: " + await wallet.getAddress()); 
  spinner.info("Your wallet public key: " + wallet.publicKey());
  spinner.info("Your wallet signing public key: " + wallet.signingPublicKey());
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

  spinner.start("Setting up Akord account for you...")
  await Auth.signUp(email, password, { clientType: "CLI" });

  spinner.succeed("Your account was successfully created. We have sent you the verification code.");
  const code = (await askForCode()).code;
  await Auth.verifyAccount(email, code);
  spinner.info("Your email was verified! You can now login and use the Akord CLI");
  process.exit(0);
}

async function vaultCreateHandler(argv: {
  name: string,
  termsOfAccess: string
}) {
  const name = argv.name;
  const termsOfAccess = argv.termsOfAccess;

  const akord = await loadCredentials();
  spinner.start("Setting up new vault...")
  const { vaultId, transactionId } = await akord.vault.create(name, { termsOfAccess });
  spinner.succeed("Vault successfully created with id: " + vaultId);
  displayResponse(transactionId);
  process.exit(0);
}

async function retrievePassword(useVault: boolean, account: string = "default"): Promise<string> {
  const service = "akord";

  let password: string;

  if (useVault) {
    try {
      password = await keytar.getPassword(service, account);
    } catch (err) { }

    if (password) {
      return password;
    }
  }

  password = (await askForPassword()).password;

  try {
    await keytar.setPassword(service, account, password);
  } catch (err) { }

  return password;
}

async function readEncryptedConfig(config: StoredEncryptedWallet): Promise<StoredWallet> {
  const password = await retrievePassword(true, config.account);
  const iv = Buffer.from(config.aes.iv, "base64");
  const pbkdf2Settings = { ...config.pbkdf2, salt: Buffer.from(config.pbkdf2.salt, "base64") };
  const key = await deriveKey(password, pbkdf2Settings);
  const decipher = createDecipheriv(config.aes.algorithm, key, iv);
  decipher.setAuthTag(Buffer.from(config.aes.authTag, "base64"));
  let rawConfig = decipher.update(config.encryptedWallet, "base64", "utf8");
  rawConfig += decipher.final("utf8");
  return JSON.parse(rawConfig);
}

async function loadCredentials(): Promise<Akord> {
  try {
    const encryptedWallet = JSON.parse(storage.getItem("wallet")) as StoredEncryptedWallet;
    if (encryptedWallet) {
      const walletData = await readEncryptedConfig(encryptedWallet);
      const wallet = new AkordWallet(walletData.mnemonic);
      await (<AkordWallet>wallet).deriveKeys();
      return await Akord.init(wallet)
    }
  } catch (error) {
    spinner.fail("Oops, something went wrong when loading your wallet: " + error);
    spinner.info("Make sure that your keyfile is configured: akord wallet:configure --help");
    process.exit(0);
  }
}

async function vaultRenameHandler(argv: {
  vaultId: string,
  name: string
}) {
  const vaultId = argv.vaultId;
  const name = argv.name;

  const akord = await loadCredentials();
  spinner.start("Renaming your vault...")
  const { transactionId } = await akord.vault.rename(vaultId, name);
  displayResponse(transactionId);
  process.exit(0);
}

async function vaultArchiveHandler(argv: { vaultId: string }) {
  const vaultId = argv.vaultId;

  const akord = await loadCredentials();
  spinner.start("Archiving your vault...")
  const { transactionId } = await akord.vault.archive(vaultId);
  displayResponse(transactionId);
  process.exit(0);
}

async function vaultRestoreHandler(argv: { vaultId: string }) {
  const vaultId = argv.vaultId;

  const akord = await loadCredentials();
  spinner.start("Restoring your vault...")
  const { transactionId } = await akord.vault.restore(vaultId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackCreateHandler(argv: {
  vaultId: string,
  parentId?: string,
  name: string
}) {
  const vaultId = argv.vaultId
  const parentId = argv.parentId
  const file = <any>(await _getFile(argv));
  const name = argv.name || file.name || (await askForStackName(file.name)).name;

  const akord = await loadCredentials();
  spinner.start("Creating new stack...")
  const { stackId, transactionId } = await akord.stack.create(vaultId, file, name, { parentId });
  spinner.succeed("Stack successfully created with id: " + stackId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackImportHandler(argv: {
  vaultId: string,
  fileTxId: string,
  parentId?: string
}) {
  const { vaultId, fileTxId, parentId } = argv;

  const akord = await loadCredentials();
  spinner.start("Importing transaction...")
  const { stackId, transactionId } = await akord.stack.import(vaultId, fileTxId, { parentId });
  spinner.succeed("Stack successfully created with id: " + stackId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackUploadRevisionHandler(argv: { stackId: string }) {
  const stackId = argv.stackId;
  const file = await _getFile(argv);

  const akord = await loadCredentials();
  spinner.start("Uploading new stack version...")
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
  const stackId = argv.stackId;
  const name = argv.name;

  const akord = await loadCredentials();
  spinner.start("Renaming the stack...")
  const { transactionId } = await akord.stack.rename(stackId, name);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackRevokeHandler(argv: { stackId: string }) {
  const stackId = argv.stackId;

  const akord = await loadCredentials();
  spinner.start("Revoking the stack...")
  const { transactionId } = await akord.stack.revoke(stackId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackRestoreHandler(argv: { stackId: string }) {
  const stackId = argv.stackId;

  const akord = await loadCredentials();
  spinner.start("Restoring the stack...")
  const { transactionId } = await akord.stack.restore(stackId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackDeleteHandler(argv: { stackId: string }) {
  const stackId = argv.stackId;

  const akord = await loadCredentials();
  spinner.start("Deleting the stack...")
  const { transactionId } = await akord.stack.delete(stackId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackMoveHandler(argv: {
  stackId: string,
  parentId?: string
}) {
  const stackId = argv.stackId;
  const parentId = argv.parentId;

  const akord = await loadCredentials();
  spinner.start("Moving the stack...")
  const { transactionId } = await akord.stack.move(stackId, parentId);
  displayResponse(transactionId);
  process.exit(0);
}

async function diffHandler(argv: { source: string, destination: string }) {
  const source = argv.source;
  const destination = argv.destination;
  spinner.start('Checking the diff...');
  const diff = await sync(source, destination, { dryRun: true });
  spinner.stop();
  logDiff(diff, { delete: true })
  process.exit(0);
}

async function syncHandler(argv: { source: string, destination: string, dryRun?: boolean, autoApprove?: boolean, delete?: boolean, recursive?: boolean, allowEmptyDirs?: boolean, excludeHidden?: boolean }) {
  const source = argv.source;
  const destination = argv.destination;

  spinner.start('Checking the diff...');

  const diff = await sync(source, destination, {
    dryRun: argv.dryRun,
    autoApprove: argv.autoApprove,
    delete: argv.delete,
    recursive: argv.recursive,
    allowEmptyDirs: argv.allowEmptyDirs,
    excludeHidden: argv.excludeHidden,
    onApprove: async (diff) => {
      spinner.stop()
      logDiff(diff, { delete: argv.delete })
      if (!diff.created.length && !diff.updated.length && (!argv.delete || (argv.delete && !diff.deleted.length))) {
        spinner.info("No changes detected. Closing")
        return false
      }
      if (destination.startsWith(AkordStorage.uriPrefix) && diff.totalStorage) {
        spinner.info(`Total consumed storage after sync: ${formatStorage(diff.totalStorage)}`)
      }
      const confirmation = argv.autoApprove || (await askForConfirmation()).confirmation;
      if (!confirmation) {
        return false
      }
      return true
    },
    onProgress: (progress, error) => {
      if (spinner && spinner.isSpinning) {
        if (error) {
          spinner.fail()
          spinner = ora(progress)
          spinner.start()
          spinner.fail()
          return
        }
        else {
          spinner.succeed()
        }
      }
      spinner = ora(progress)
      spinner.start()
    },
    onDone: () => {
      if (spinner && spinner.isSpinning) {
        spinner.succeed()
      }
      console.log()
      spinner.succeed("All done\n")
    }
  })

  if (argv.dryRun) {
    spinner.stop()
    logDiff(diff, { delete: argv.delete })
  }
  process.exit(0);
}

const logDiff = (diff: StorageDiff, options: { delete?: boolean } = {}) => {
  diff.created.forEach(object => console.log(clc.green(`Add:      ${object.key} (${formatStorage(object.size)})`)))
  diff.updated.forEach(object => console.log(clc.yellow(`Update:    ${object.key} (${formatStorage(object.size)})`)))
  if (options.delete) {
    diff.deleted.forEach(object => console.log(clc.red(`Delete:    ${object.key} (${formatStorage(object.size)})`)))
  }
  diff.excluded.forEach(object => console.log(clc.white(`Excluded:    ${object.key} (${formatStorage(object.size)})`)))
}

async function memoCreateHandler(argv: {
  vaultId: string,
  message: string
}) {
  const vaultId = argv.vaultId;
  const message = argv.message;

  const akord = await loadCredentials();
  spinner.start("Creating memo...")
  const { memoId, transactionId } = await akord.memo.create(vaultId, message);
  spinner.succeed("Memo successfully created with id: " + memoId);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderCreateHandler(argv: {
  vaultId: string,
  parentId?: string,
  name: string
}) {
  const vaultId = argv.vaultId;
  const parentId = argv.parentId;
  const name = argv.name;

  const akord = await loadCredentials();
  spinner.start("Creating folder...")
  const { folderId, transactionId } = await akord.folder.create(vaultId, name, { parentId });
  spinner.succeed("Folder successfully created with id: " + folderId);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderRenameHandler(argv: {
  folderId: string,
  name: string
}) {
  const folderId = argv.folderId;
  const name = argv.name;

  const akord = await loadCredentials();
  spinner.start("Renaming the folder...")
  const { transactionId } = await akord.folder.rename(folderId, name);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderMoveHandler(argv: {
  folderId: string,
  parentId?: string
}) {
  const folderId = argv.folderId;
  const parentId = argv.parentId;

  const akord = await loadCredentials();
  spinner.start("Moving the folder...")
  const { transactionId } = await akord.folder.move(folderId, parentId);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderRevokeHandler(argv: { folderId: string }) {
  const folderId = argv.folderId;

  const akord = await loadCredentials();
  spinner.start("Revoking the folder...")
  const { transactionId } = await akord.folder.revoke(folderId);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderRestoreHandler(argv: { folderId: string }) {
  const folderId = argv.folderId;

  const akord = await loadCredentials();
  spinner.start("Restoring the folder...")
  const { transactionId } = await akord.folder.restore(folderId);
  displayResponse(transactionId);
  process.exit(0);
}

async function folderDeleteHandler(argv: { folderId: string }) {
  const folderId = argv.folderId;

  const akord = await loadCredentials();
  spinner.start("Deleting the folder...")
  const { transactionId } = await akord.folder.delete(folderId);
  displayResponse(transactionId);
  process.exit(0);
}

function getFileFromPath(filePath: string) {
  let file = <any>{};
  if (!fs.existsSync(filePath)) {
    spinner.fail("Could not find a file in your filesystem: " + filePath);
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
  const vaultId = argv.vaultId;
  const email = argv.email;

  const role = argv.role || (await askForRole()).role;

  const akord = await loadCredentials();
  spinner.start("Sending the invite...")
  const { transactionId } = await akord.membership.invite(vaultId, email, role);
  displayResponse(transactionId);
  process.exit(0);
}

async function membershipAcceptHandler(argv: { membershipId: string }) {
  const membershipId = argv.membershipId;

  const akord = await loadCredentials();
  spinner.start("Accepting the invite...")
  const { transactionId } = await akord.membership.accept(membershipId);
  displayResponse(transactionId);
  process.exit(0);
}

async function membershipRejectHandler(argv: { membershipId: string }) {
  const membershipId = argv.membershipId;

  const akord = await loadCredentials();
  spinner.start("Rejecting the invite...")
  const { transactionId } = await akord.membership.reject(membershipId);
  displayResponse(transactionId);
  process.exit(0);
}

async function membershipRevokeHandler(argv: { membershipId: string }) {
  const membershipId = argv.membershipId;

  const akord = await loadCredentials();
  spinner.start("Revoking the member...")
  const { transactionId } = await akord.membership.revoke(membershipId);
  displayResponse(transactionId);
  process.exit(0);
}

async function vaultListHandler() {

  const akord = await loadCredentials();
  const response = await akord.vault.listAll();
  console.table(response.map((vault) => ({
    id: vault.id,
    name: vault.name,
    public: vault.public,
    size: vault.size,
    createdAt: vault.createdAt,
  })));
  process.exit(0);
}

async function vaultGetHandler(argv: { vaultId: string }) {
  const vaultId = argv.vaultId;

  const akord = await loadCredentials();
  const response = await akord.vault.get(vaultId);
  console.log(response);
  process.exit(0);
}

async function manifestGenerateHandler(argv: { vaultId: string }) {
  const { vaultId } = argv;

  const akord = await loadCredentials();
  const { transactionId } = await akord.manifest.generate(vaultId);
  displayResponse(transactionId);
  process.exit(0);
}

async function stackListHandler(argv: { vaultId: string }) {
  const vaultId = argv.vaultId;

  const akord = await loadCredentials();
  const response = await akord.stack.listAll(vaultId);
  console.table(response.map((stack) => ({
    id: stack.id,
    name: stack.name,
    parentId: stack.parentId,
    versions: stack.versions.length,
    status: stack.status,
    createdAt: stack.createdAt,
  })));
  process.exit(0);
}

async function folderListHandler(argv: { vaultId: string }) {
  const vaultId = argv.vaultId;

  const akord = await loadCredentials();
  const response = await akord.folder.listAll(vaultId);
  console.table(response.map((folder) => ({
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    status: folder.status,
    createdAt: folder.createdAt,
  })));
  process.exit(0);
}

async function folderGetHandler(argv: { folderId: string }) {
  const folderId = argv.folderId;

  const akord = await loadCredentials();
  const response = await akord.folder.get(folderId);
  console.log(response);
  process.exit(0);
}

async function stackGetHandler(argv: { stackId: string }) {
  const stackId = argv.stackId;

  const akord = await loadCredentials();
  const response = await akord.stack.get(stackId);
  console.log(response);
  process.exit(0);
}

async function membershipListHandler(argv: { vaultId: string }) {
  const vaultId = argv.vaultId;

  const akord = await loadCredentials();
  const response = await akord.membership.listAll(vaultId);
  console.table(response.map((membership) => ({
    id: membership.id,
    role: membership.role,
    email: membership.memberDetails.email,
    status: membership.status,
    createdAt: membership.createdAt,
  })));
  process.exit(0);
}

async function stackDownloadHandler(argv: { stackId: string, fileVersion: string, filePath: string }) {
  const stackId = argv.stackId;
  const version = argv.fileVersion;
  let filePath = argv.filePath;

  if (filePath && fs.existsSync(filePath)) {
    spinner.fail("File within the given path already exist, please choose a different path and try again.");
    process.exit(0);
  }
  const akord = await loadCredentials();
  const { name, data } = await akord.stack.getVersion(stackId, +version);
  if (!filePath) {
    filePath = process.cwd() + "/" + name;
    if (fs.existsSync(filePath)) {
      filePath = process.cwd() + "/" + randomUUID() + "-" + name;
    }
  }
  fs.writeFileSync(filePath, Buffer.from(data));
  spinner.fail("The file was successfully downloaded, decrypted & stored in: " + filePath);
  process.exit(0);
}

export {
  CONFIG_STORE_PATH,
  displayError,
  loadCredentials,
  vaultCreateHandler,
  vaultRenameHandler,
  vaultArchiveHandler,
  vaultRestoreHandler,
  manifestGenerateHandler,
  memoCreateHandler,
  diffHandler,
  syncHandler,
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
