import figlet from "figlet";
import fs from "fs";
import clc from "cli-color";
import os from "os";
import { promisify } from "util";
import * as keytar from "keytar";
import { Akord, Auth, Vault, VaultCreateOptions } from "@akord/akord-js";
import { AkordWallet } from "@akord/crypto";
import {
  CipherGCMTypes,
  createCipheriv,
  createDecipheriv,
  pbkdf2 as pbkdf2Cb,
  randomBytes,
  randomUUID,
} from "crypto";
import { sync } from "./sync";
import formatStorage from "./sync/storage/formatter";
import { AkordStorage } from "./sync/storage/impl/akord-storage";
import {
  askForFilePath,
  askForRole,
  askForPassword,
  askForCode,
  askForWaiveOfWithdrawalRight,
  askForTermsOfServiceAndPrivacyPolicy,
  askForConfirmation,
} from "./inquirers";
import { StorageDiff } from "./sync/storage/types";
import { Argv } from "yargs";
import { isVerbose, logger, spinner } from "./logger";
import { FileStorage } from "./store";
import { AKORD_ENV } from "./config";

const CONFIG_STORE_PATH = `${os.homedir()}/.akord`;
const CREDENTIALS_STORE_PATH = `${CONFIG_STORE_PATH}/credentials`;
const VAULT_SERVICE_NAME = "akord";

const storage = new FileStorage(CREDENTIALS_STORE_PATH);
const pbkdf2 = promisify(pbkdf2Cb);

configure();

function configure() {
  Auth.configure({ storage: storage, env: AKORD_ENV });
  if (!fs.existsSync(CONFIG_STORE_PATH)) {
    fs.mkdirSync(CONFIG_STORE_PATH, { recursive: true });
  } else {
    if (fs.statSync(CONFIG_STORE_PATH).isFile()) {
      fs.unlinkSync(CONFIG_STORE_PATH);
      fs.mkdirSync(CONFIG_STORE_PATH, { recursive: true });
    }
  }
}

function storeWallet(walletData) {
  try {
    storage.setItem("wallet", walletData);
    spinner.info("Your wallet was stored at: ~/.akord/credentials");
  } catch (error) {
    spinner.fail(
      "Oops, something went wrong when storing your wallet: " + error?.message
    );
    logger.error(error);
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

function deriveKey(
  password: string,
  pbkdf2Settings: PBKDF2Settings,
  length: number = 32
): Promise<Buffer> {
  return pbkdf2(
    password,
    pbkdf2Settings.salt,
    pbkdf2Settings.iterations,
    length,
    pbkdf2Settings.algorithm
  );
}

async function encryptWallet(
  password: string,
  storedWallet: StoredWallet
): Promise<StoredEncryptedWallet> {
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
  encryptedWallet += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");
  return {
    account: storedWallet.account,
    encryptedWallet,
    pbkdf2: { ...pbkdf2Settings, salt: pbkdf2Settings.salt.toString("base64") },
    aes: { algorithm: aesAlgorithm, iv: iv.toString("base64"), authTag },
  };
}

async function decryptWallet(
  password: string,
  storedEncryptedWallet: StoredEncryptedWallet
): Promise<StoredEncryptedWallet> {
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
  );
  let decryptedWallet = decipher.update(
    storedEncryptedWallet.encryptedWallet,
    "base64",
    "utf8"
  );
  decryptedWallet += decipher.final("base64");
  return JSON.parse(decryptedWallet);
}

function displayResponse(transactionId: string, cloud?: boolean) {
  if (spinner && spinner.isSpinning) {
    spinner.succeed();
  }
  if (isVerbose) {
    if (!cloud) {
      spinner.succeed(
        "Your transaction has been successfully committed. You can view it in the explorer by visiting the link below:"
      );
      spinner.info("https://sonar.warp.cc/#/app/interaction/" + transactionId);
    }
  } else {
    console.log(transactionId);
  }
}

function displayError(msg: string, err: Error, yargs: Argv) {
  if (spinner && spinner.isSpinning) {
    spinner.fail();
  }
  if (msg) {
    spinner.fail(msg);
    logger.error(msg);
    logger.error(err);
  } else if (err) {
    spinner.fail(err.message);
    logger.error(err);
  } else {
    spinner.fail(
      "Something went wrong. Log is available under: " + CONFIG_STORE_PATH
    );
  }
  process.exit(1);
}

async function loginHandler(argv: {
  email: string;
  password?: string;
  token?: boolean;
}) {
  console.log(figlet.textSync("Akord", { horizontalLayout: "full" }));
  const email = argv.email;
  const isTokenResponse = argv.token;
  let password = argv.password;

  if (!password) {
    password = (await askForPassword()).password;
  }

  spinner.start("Signing in...");

  Auth.configure({ env: AKORD_ENV, storage: storage });
  const { wallet, jwt } = await Auth.signIn(email, password);
  await storePassword(email, password);

  const encryptedWallet = await encryptWallet(password, {
    mnemonic: wallet.backupPhrase,
    account: email,
  });
  storeWallet(JSON.stringify(encryptedWallet));

  if (isTokenResponse) {
    console.log(jwt);
  } else {
    spinner.info("Your wallet address: " + (await wallet.getAddress()));
    spinner.info("Your wallet public key: " + wallet.publicKey());
    spinner.info(
      "Your wallet signing public key: " + wallet.signingPublicKey()
    );
  }
  process.exit(0);
}

async function signupHandler(argv: { email: string; password?: string }) {
  console.log(figlet.textSync("Akord", { horizontalLayout: "full" }));

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

  spinner.start("Setting up Akord account for you...");
  Auth.configure({ env: AKORD_ENV, storage: storage });
  await Auth.signUp(email, password, { clientType: "CLI" });

  spinner.succeed(
    "Your account was successfully created. We have sent you the verification code."
  );
  const code = (await askForCode()).code;
  await Auth.verifyAccount(email, code);
  spinner.info(
    "Your email was verified! You can now login and use the Akord CLI"
  );
  process.exit(0);
}

async function deployHandler(argv: {
  source: string;
  name: string;
  index: string;
  manifest: string;
}) {
  const { source, index } = argv;
  let name = argv.name;
  let manifest = argv.manifest;

  if (!name) {
    let sourceSplit = source.split("/");
    name = sourceSplit[sourceSplit.length - 1];
  }

  const akord = await loadCredentials();

  const vaultsList = await akord.vault.listAll();
  let vault: Vault | undefined = vaultsList.find(
    (vault) => vault.name === name
  );
  let vaultId = "";
  let transactionId = "";
  if (!vault) {
    spinner.start("Setting up new vault...");
    const options = { public: true } as VaultCreateOptions;
    ({ vaultId, transactionId } = await akord.vault.create(name, options));
    spinner.succeed("Vault successfully created with id: " + vaultId);
    displayResponse(transactionId);
  } else {
    vaultId = vault.id;
    spinner.info(`Vault ${name} already exists [id: ${vaultId}]`);
  }

  const diff = await syncHandler(
    {
      source: source,
      destination: `akord://${vaultId}`,
      dryRun: true,
      autoApprove: true,
      includeHidden: true,
      recursive: true,
    },
    false
  );
  if (diff.created.length || diff.updated.length) {
    await syncHandler(
      {
        source: source,
        destination: `akord://${vaultId}`,
        autoApprove: true,
        includeHidden: true,
        recursive: true,
      },
      false,
      false
    );
    if (manifest) {
      spinner.info(`Parsing manifest file for vault ${name}`);
      const jsonData = fs.readFileSync(manifest, "utf-8");
      manifest = JSON.parse(jsonData);
    } else {
      spinner.info(`Generating manifest file for vault ${name}`);
    }
    const { uri } = await manifestGenerateHandler(
      { vaultId: vaultId, index: index, manifest: manifest },
      false
    );
    spinner.succeed(
      `Your deployed website will be reachable in a few minutes here: https://arweave.net/${uri}`
    );
  } else {
    spinner.info("No changes detected - you are up to date");
  }
}

async function vaultCreateHandler(argv: {
  name: string;
  termsOfAccess: string;
  description: string;
  verbose: string;
  public: boolean;
  cloud: boolean;
}) {
  const { name, termsOfAccess, public: isPublic, description, cloud } = argv;

  const akord = await loadCredentials();
  spinner.start("Setting up new vault...");
  const { vaultId, transactionId } = await akord.vault.create(name, {
    description,
    termsOfAccess,
    public: isPublic,
    cloud,
  });
  spinner.succeed("Vault successfully created with id: " + vaultId);
  displayResponse(transactionId, cloud);
  return { vaultId, transactionId };
}

async function retrievePassword(account: string = "default"): Promise<string> {
  let password: string;
  try {
    password = await keytar.getPassword(VAULT_SERVICE_NAME, account);
  } catch (err) {}
  return password;
}

async function storePassword(
  account: string = "default",
  password: string
): Promise<string> {
  try {
    await keytar.setPassword(VAULT_SERVICE_NAME, account, password);
  } catch (err) {}

  return password;
}

async function readEncryptedConfig(
  config: StoredEncryptedWallet
): Promise<StoredWallet> {
  const password = await retrievePassword(config.account);
  const iv = Buffer.from(config.aes.iv, "base64");
  const pbkdf2Settings = {
    ...config.pbkdf2,
    salt: Buffer.from(config.pbkdf2.salt, "base64"),
  };
  const key = await deriveKey(password, pbkdf2Settings);
  const decipher = createDecipheriv(config.aes.algorithm, key, iv);
  decipher.setAuthTag(Buffer.from(config.aes.authTag, "base64"));
  let rawConfig = decipher.update(config.encryptedWallet, "base64", "utf8");
  rawConfig += decipher.final("utf8");
  return JSON.parse(rawConfig);
}

async function loadCredentials(): Promise<Akord> {
  try {
    const encryptedWallet = JSON.parse(
      storage.getItem("wallet")
    ) as StoredEncryptedWallet;
    if (encryptedWallet) {
      const walletData = await readEncryptedConfig(encryptedWallet);
      const wallet = new AkordWallet(walletData.mnemonic);
      await (<AkordWallet>wallet).deriveKeys();
      return new Akord(wallet, { env: AKORD_ENV, storage: storage });
    }
  } catch (error) {
    logger.error(error);
    spinner.fail("Oops, something went wrong when loading your wallet");
    spinner.info("Login first with: akord login {your_email}");
    process.exit(0);
  }
}

async function vaultRenameHandler(argv: { vaultId: string; name: string }) {
  const vaultId = argv.vaultId;
  const name = argv.name;

  const akord = await loadCredentials();
  spinner.start("Renaming your vault...");
  const { transactionId, object } = await akord.vault.rename(vaultId, name);
  displayResponse(transactionId, object.cloud);
  process.exit(0);
}

async function vaultArchiveHandler(argv: { vaultId: string }) {
  const vaultId = argv.vaultId;

  const akord = await loadCredentials();
  spinner.start("Archiving your vault...");
  const { transactionId, object } = await akord.vault.archive(vaultId);
  displayResponse(transactionId, object.cloud);
  process.exit(0);
}

async function vaultRestoreHandler(argv: { vaultId: string }) {
  const vaultId = argv.vaultId;

  const akord = await loadCredentials();
  spinner.start("Restoring your vault...");
  const { transactionId, object } = await akord.vault.restore(vaultId);
  displayResponse(transactionId, object.cloud);
  process.exit(0);
}

async function zipUploadHandler(argv: {
  vaultId: string;
  filePath?: string;
  fileType?: string;
  fileName?: string;
  parentId?: string;
}) {
  const { vaultId, parentId, filePath } = argv;

  const akord = await loadCredentials();
  spinner.start("Uploading zip...");
  const { sourceId } = await akord.zip.upload(
    vaultId,
    filePath || (await askForFilePath()).filePath,
    { parentId: parentId }
  );
  spinner.succeed("Zip successfully uploaded with id: " + sourceId);
  process.exit(0);
}

async function stackCreateHandler(argv: {
  vaultId: string;
  filePath?: string;
  fileType?: string;
  fileName?: string;
  parentId?: string;
}) {
  const vaultId = argv.vaultId;
  const parentId = argv.parentId;

  const filePath = argv.filePath || (await askForFilePath()).filePath;
  const fileType = argv.fileType;

  const akord = await loadCredentials();
  spinner.start("Creating new stack...");
  const { stackId, transactionId, uri, object } = await akord.stack.create(
    vaultId,
    filePath,
    { parentId, name: argv.fileName, mimeType: fileType }
  );
  spinner.succeed("Stack successfully created with id: " + stackId);
  displayResponse(transactionId, object.__cloud__);
  if (!object.__cloud__) {
    spinner.info(
      "Once the transaction is accepted on Arweave network (it takes 5-15 minutes on average),"
    );
    spinner.info(
      "you can access your file on ViewBlock by visiting the following URL: https://viewblock.io/arweave/tx/" +
        uri
    );
  }
  process.exit(0);
}

async function stackImportHandler(argv: {
  vaultId: string;
  fileTxId: string;
  parentId?: string;
}) {
  const { vaultId, fileTxId, parentId } = argv;

  const akord = await loadCredentials();
  spinner.start("Importing transaction...");
  const { stackId, transactionId, object } = await akord.stack.import(
    vaultId,
    fileTxId,
    { parentId }
  );
  spinner.succeed("Stack successfully created with id: " + stackId);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function stackUploadRevisionHandler(argv: {
  stackId: string;
  filePath?: string;
  fileType?: string;
  fileName?: string;
}) {
  const stackId = argv.stackId;

  const filePath = argv.filePath || (await askForFilePath()).filePath;
  const fileType = argv.fileType;
  const fileName = argv.fileName;

  const akord = await loadCredentials();
  spinner.start("Uploading new stack version...");
  const { transactionId, uri, object } = await akord.stack.uploadRevision(
    stackId,
    filePath,
    { name: fileName, mimeType: fileType }
  );
  displayResponse(transactionId, object.__cloud__);
  if (!object.__cloud__) {
    spinner.info(
      "Once the transaction is accepted on Arweave network (it takes 5-15 minutes on average),"
    );
    spinner.info(
      "you can access your file on ViewBlock by visiting the following URL: https://viewblock.io/arweave/tx/" +
        uri
    );
  }
  process.exit(0);
}

async function stackRenameHandler(argv: { stackId: string; name: string }) {
  const stackId = argv.stackId;
  const name = argv.name;

  const akord = await loadCredentials();
  spinner.start("Renaming the stack...");
  const { transactionId, object } = await akord.stack.rename(stackId, name);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function stackRevokeHandler(argv: { stackId: string }) {
  const stackId = argv.stackId;

  const akord = await loadCredentials();
  spinner.start("Revoking the stack...");
  const { transactionId, object } = await akord.stack.revoke(stackId);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function stackRestoreHandler(argv: { stackId: string }) {
  const stackId = argv.stackId;

  const akord = await loadCredentials();
  spinner.start("Restoring the stack...");
  const { transactionId, object } = await akord.stack.restore(stackId);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function stackDeleteHandler(argv: { stackId: string }) {
  const stackId = argv.stackId;

  const akord = await loadCredentials();
  spinner.start("Deleting the stack...");
  const { transactionId, object } = await akord.stack.delete(stackId);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function stackMoveHandler(argv: { stackId: string; parentId?: string }) {
  const stackId = argv.stackId;
  const parentId = argv.parentId;

  const akord = await loadCredentials();
  spinner.start("Moving the stack...");
  const { transactionId, object } = await akord.stack.move(stackId, parentId);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function diffHandler(argv: { source: string; destination: string }) {
  const source = argv.source;
  const destination = argv.destination;
  spinner.start("Checking the diff...");
  const diff = await sync(source, destination, { dryRun: true });
  spinner.stop();
  logDiff(diff, { delete: true });
  process.exit(0);
}

async function syncHandler(
  argv: {
    source: string;
    destination: string;
    dryRun?: boolean;
    autoApprove?: boolean;
    delete?: boolean;
    recursive?: boolean;
    allowEmptyDirs?: boolean;
    includeHidden?: boolean;
  },
  exit: boolean = true,
  log: boolean = true
) {
  const source = argv.source;
  const destination = argv.destination;

  spinner.start("Checking the diff...");

  const diff = await sync(source, destination, {
    dryRun: argv.dryRun,
    autoApprove: argv.autoApprove,
    delete: argv.delete,
    recursive: argv.recursive,
    allowEmptyDirs: argv.allowEmptyDirs,
    includeHidden: argv.includeHidden,
    onApprove: async (diff) => {
      spinner.stop();
      if (log) {
        logDiff(diff, { delete: argv.delete });
      }
      if (
        !diff.created.length &&
        !diff.updated.length &&
        (!argv.delete || (argv.delete && !diff.deleted.length))
      ) {
        spinner.info("No changes detected. Closing");
        return false;
      }
      if (destination.startsWith(AkordStorage.uriPrefix) && diff.totalStorage) {
        spinner.info(
          `Total consumed storage after sync: ${formatStorage(
            diff.totalStorage
          )}`
        );
      }
      const confirmation =
        argv.autoApprove || (await askForConfirmation()).confirmation;
      if (!confirmation) {
        return false;
      }
      return true;
    },
    onProgress: (progress, error) => {
      if (spinner && spinner.isSpinning) {
        if (error) {
          spinner.fail();
          spinner.start(progress);
          spinner.fail();
          return;
        } else {
          spinner.succeed();
        }
      }
      spinner.start(progress);
    },
    onDone: () => {
      if (spinner && spinner.isSpinning) {
        spinner.succeed();
      }
      console.log();
      spinner.succeed("All done\n");
    },
  });

  if (argv.dryRun) {
    spinner.stop();
    logDiff(diff, { delete: argv.delete });
  }
  if (exit) {
    process.exit(0);
  } else {
    return diff;
  }
}

const logDiff = (diff: StorageDiff, options: { delete?: boolean } = {}) => {
  diff.created.forEach((object) =>
    console.log(
      clc.green(`Add:      ${object.key} (${formatStorage(object.size)})`)
    )
  );
  diff.updated.forEach((object) =>
    console.log(
      clc.yellow(`Update:    ${object.key} (${formatStorage(object.size)})`)
    )
  );
  if (options.delete) {
    diff.deleted.forEach((object) =>
      console.log(
        clc.red(`Delete:    ${object.key} (${formatStorage(object.size)})`)
      )
    );
  }
  diff.excluded.forEach((object) =>
    console.log(
      clc.white(`Excluded:    ${object.key} (${formatStorage(object.size)})`)
    )
  );
};

async function memoCreateHandler(argv: { vaultId: string; message: string }) {
  const vaultId = argv.vaultId;
  const message = argv.message;

  const akord = await loadCredentials();
  spinner.start("Creating memo...");
  const { memoId, transactionId, object } = await akord.memo.create(
    vaultId,
    message
  );
  spinner.succeed("Memo successfully created with id: " + memoId);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function folderCreateHandler(argv: {
  vaultId: string;
  parentId?: string;
  name: string;
}) {
  const vaultId = argv.vaultId;
  const parentId = argv.parentId;
  const name = argv.name;

  const akord = await loadCredentials();
  spinner.start("Creating folder...");
  const { folderId, transactionId, object } = await akord.folder.create(
    vaultId,
    name,
    { parentId }
  );
  spinner.succeed("Folder successfully created with id: " + folderId);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function folderRenameHandler(argv: { folderId: string; name: string }) {
  const folderId = argv.folderId;
  const name = argv.name;

  const akord = await loadCredentials();
  spinner.start("Renaming the folder...");
  const { transactionId, object } = await akord.folder.rename(folderId, name);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function folderMoveHandler(argv: {
  folderId: string;
  parentId?: string;
}) {
  const folderId = argv.folderId;
  const parentId = argv.parentId;

  const akord = await loadCredentials();
  spinner.start("Moving the folder...");
  const { transactionId, object } = await akord.folder.move(folderId, parentId);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function folderRevokeHandler(argv: { folderId: string }) {
  const folderId = argv.folderId;

  const akord = await loadCredentials();
  spinner.start("Revoking the folder...");
  const { transactionId, object } = await akord.folder.revoke(folderId);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function folderRestoreHandler(argv: { folderId: string }) {
  const folderId = argv.folderId;

  const akord = await loadCredentials();
  spinner.start("Restoring the folder...");
  const { transactionId, object } = await akord.folder.restore(folderId);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function folderDeleteHandler(argv: { folderId: string }) {
  const folderId = argv.folderId;

  const akord = await loadCredentials();
  spinner.start("Deleting the folder...");
  const { transactionId, object } = await akord.folder.delete(folderId);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function membershipInviteHandler(argv: {
  vaultId: string;
  email: string;
  role?: string;
}) {
  const vaultId = argv.vaultId;
  const email = argv.email;

  const role = argv.role || (await askForRole()).role;

  const akord = await loadCredentials();
  spinner.start("Sending the invite...");
  const { transactionId, object } = await akord.membership.invite(
    vaultId,
    email,
    role
  );
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function membershipAcceptHandler(argv: { membershipId: string }) {
  const membershipId = argv.membershipId;

  const akord = await loadCredentials();
  spinner.start("Accepting the invite...");
  const { transactionId, object } = await akord.membership.accept(membershipId);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function membershipRejectHandler(argv: { membershipId: string }) {
  const membershipId = argv.membershipId;

  const akord = await loadCredentials();
  spinner.start("Rejecting the invite...");
  const { transactionId, object } = await akord.membership.reject(membershipId);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function membershipRevokeHandler(argv: { membershipId: string }) {
  const membershipId = argv.membershipId;

  const akord = await loadCredentials();
  spinner.start("Revoking the member...");
  const { transactionId, object } = await akord.membership.revoke(membershipId);
  displayResponse(transactionId, object.__cloud__);
  process.exit(0);
}

async function vaultListHandler() {
  const akord = await loadCredentials();
  const response = await akord.vault.listAll();
  console.table(
    response.map((vault) => ({
      id: vault.id,
      name: vault.name,
      public: vault.public,
      permanent: !vault.cloud,
      size: vault.size,
      createdAt: vault.createdAt,
    }))
  );
  process.exit(0);
}

async function vaultGetHandler(argv: { vaultId: string }) {
  const vaultId = argv.vaultId;

  const akord = await loadCredentials();
  const response = await akord.vault.get(vaultId);
  console.log(response);
  process.exit(0);
}

async function manifestGenerateHandler(
  argv: {
    vaultId: string;
    index: string;
    manifest: JSON | Object;
    parentId?: string;
  },
  exit: boolean = true
) {
  const { vaultId, index, manifest, parentId } = argv;

  const akord = await loadCredentials();
  spinner.start("Generating manifest...");
  const { uri } = await akord.manifest.generate(vaultId, {
    indexName: index,
    manifest: manifest,
    parentId: parentId,
  });
  spinner.succeed("Manifest successfully generated.");
  spinner.succeed(
    "Once the transaction is accepted on Arweave network (it takes 5-15 minutes on average), you can access it here:"
  );
  spinner.succeed("https://arweave.net/" + uri);
  if (exit) {
    process.exit(0);
  } else {
    return { uri };
  }
}

async function stackListHandler(argv: { vaultId: string }) {
  const vaultId = argv.vaultId;

  const akord = await loadCredentials();
  const response = await akord.stack.listAll(vaultId);
  console.table(
    response.map((stack) => ({
      id: stack.id,
      name: stack.name,
      ["latest file uri"]: stack.uri,
      parentId: stack.parentId,
      versions: stack.versions.length,
      status: stack.status,
      createdAt: stack.createdAt,
    }))
  );
  process.exit(0);
}

async function folderListHandler(argv: { vaultId: string }) {
  const vaultId = argv.vaultId;

  const akord = await loadCredentials();
  const response = await akord.folder.listAll(vaultId);
  console.table(
    response.map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      status: folder.status,
      createdAt: folder.createdAt,
    }))
  );
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
  console.table(
    response.map((membership) => ({
      id: membership.id,
      role: membership.role,
      email: membership.memberDetails.email,
      status: membership.status,
      createdAt: membership.createdAt,
    }))
  );
  process.exit(0);
}

async function stackDownloadHandler(argv: {
  stackId: string;
  fileVersion: number;
  filePath: string;
  override: boolean;
}) {
  const stackId = argv.stackId;
  const version = argv.fileVersion;
  const shouldOverride = argv.override;
  let filePath = argv.filePath;

  const akord = await loadCredentials();

  spinner.start("Downloading file...");

  if (filePath && fs.existsSync(filePath) && !shouldOverride) {
    spinner.fail(
      "File within the given path already exists, please choose a different path or use override option."
    );
    process.exit(0);
  }

  const { name, data } = await akord.stack.getVersion(stackId, version, {
    responseType: "arraybuffer",
  });
  if (!filePath) {
    filePath = process.cwd() + "/" + name;
    if (fs.existsSync(filePath)) {
      filePath = process.cwd() + "/" + randomUUID() + "-" + name;
    }
  }
  fs.writeFileSync(filePath, Buffer.from(data as ArrayBuffer));

  spinner.info(
    "Downloaded version: " + (version !== undefined ? version : "latest")
  );
  spinner.succeed(
    "The file was successfully downloaded & stored in: " + filePath
  );
  process.exit(0);
}

export {
  spinner,
  displayError,
  loadCredentials,
  deployHandler,
  vaultCreateHandler,
  vaultRenameHandler,
  vaultArchiveHandler,
  vaultRestoreHandler,
  manifestGenerateHandler,
  memoCreateHandler,
  diffHandler,
  syncHandler,
  zipUploadHandler,
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
  stackDownloadHandler,
};
