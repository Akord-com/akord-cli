import fs from 'fs';
import path from "path";
import {
  askForFilePath,
  askForTransactionId,
  askForStackName,
  askForUploadType,
  askForRole
} from "./inquirers";
import os from 'os';
import Akord from "@akord/akord-js"
import { WalletType, Wallet, AkordWallet, WalletFactory } from "@akord/crypto"
import { ClientConfig, EnvType, LedgerVersion } from "./client-config";
import ApiAuthenticator from "./api-authenticator";

export function initInstance(config: ClientConfig, wallet: Wallet, jwtToken: string) {
  return new Akord(config, wallet, jwtToken);
}

let config = {
  env: EnvType.DEV,
  wallet: WalletType.Akord,
  ledger: LedgerVersion.V2
}

function storeWallet(walletData) {
  try {
    fs.writeFileSync(os.homedir() + "/.akord", walletData);
    console.log("Your wallet was stored successfully at: ~/.akord");
  } catch (error) {
    console.log("Oops, something went wrong when storing your wallet: " + error);
    process.exit(0);
  }
}

async function configureHandler(argv) {
  const env = argv.env;
  fs.writeFileSync(os.homedir() + "/.akord-cli-config", env);
  console.log("The CLI was configured to use the " + env + " network.");
}

async function walletImportHandler(argv) {
  const keyFile = argv.keyFile;
  try {
    const stringKey = fs.readFileSync(keyFile).toString();
    storeWallet(stringKey);
  } catch (error) {
    console.log("Oops, something went wrong when configuring your wallet: " + error);
    process.exit(0);
  }
}

async function walletCognitoHandler(argv) {
  const email = argv.email;
  const password = argv.password;

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
  console.log("Your wallet was imported & stored successfully at: ~/.akord");
  console.log("Your wallet address: " + address);
  console.log("Your wallet public key: " + publicKey);
  console.log("Your wallet signing public key: " + signingPublicKey);
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

async function walletRecoverHandler(argv) {
  const mnemonic = argv.mnemonic;
  console.log("Please be patient, recovering the wallet may take a while");
  const wallet = await AkordWallet.importFromBackupPhrase(mnemonic);
  storeWallet(JSON.stringify({
    "mnemonic": wallet.backupPhrase
  }));
  const address = await wallet.getAddress();
  const publicKey = await wallet.publicKey();
  const signingPublicKey = await wallet.signingPublicKey();
  console.log("Your wallet was imported & stored successfully at: ~/.akord");
  console.log("Your wallet address: " + address);
  console.log("Your wallet public key: " + publicKey);
  console.log("Your wallet signing public key: " + signingPublicKey);
  process.exit(0);
};

async function vaultCreateHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const name = argv.name;
  const termsOfAccess = argv.termsOfAccess;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.createVault(name, termsOfAccess);
  console.log(response);
  process.exit(0);
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

async function vaultRenameHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;
  const name = argv.name;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.vaultRename(vaultId, name);
  console.log(response);
  process.exit(0);
}

async function vaultArchiveHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.vaultArchive(vaultId);
  console.log(response);
  process.exit(0);
}

async function vaultRestoreHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.vaultRestore(vaultId);
  console.log(response);
  process.exit(0);
}

async function stackCreateHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId
  const parentId = argv.parentId
  const file = <any>(await _getFile(argv));
  const name = argv.name || file.name || (await askForStackName(file.name)).name;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.stackCreate(vaultId, file, name, parentId);
  console.log(response);
  process.exit(0);
}

async function stackUploadRevisionHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;
  const file = await _getFile(argv);

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.stackUploadRevision(stackId, file);
  console.log(response);
  process.exit(0);
}

async function _getFile(argv) {
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

async function stackRenameHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;
  const name = argv.name;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.stackRename(stackId, name);
  console.log(response);
  process.exit(0);
}

async function stackRevokeHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.stackRevoke(stackId);
  console.log(response);
  process.exit(0);
}

async function stackRestoreHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.stackRestore(stackId);
  console.log(response);
  process.exit(0);
}

async function stackDeleteHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.stackDelete(stackId);
  console.log(response);
  process.exit(0);
}

async function stackMoveHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const stackId = argv.stackId;
  const parentId = argv.parentId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.stackMove(stackId, parentId);
  console.log(response);
  process.exit(0);
}

async function memoCreateHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;
  const message = argv.message;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.memoCreate(vaultId, message);
  console.log(response);
  process.exit(0);
}

async function folderCreateHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;
  const parentId = argv.parentId;
  const name = argv.name;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.folderCreate(vaultId, name, parentId);
  console.log(response);
  process.exit(0);
}

async function folderRenameHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.stackId;
  const name = argv.name;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.folderRename(folderId, name);
  console.log(response);
  process.exit(0);
}

async function folderMoveHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.folderId;
  const parentId = argv.parentId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.folderMove(folderId, parentId);
  console.log(response);
  process.exit(0);
}

async function folderRevokeHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.stackId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.folderRevoke(folderId);
  console.log(response);
  process.exit(0);
}

async function folderRestoreHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.stackId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.folderRestore(folderId);
  console.log(response);
  process.exit(0);
}

async function folderDeleteHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const folderId = argv.stackId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.folderDelete(folderId);
  console.log(response);
  process.exit(0);
}

function getFileFromPath(filePath) {
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

async function membershipInviteHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const vaultId = argv.vaultId;
  const address = argv.address;

  const role = argv.role || (await askForRole()).role;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.membershipInvite(vaultId, address, role);
  console.log(response);
  process.exit(0);
}

async function membershipAcceptHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const membershipId = argv.membershipId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.membershipAccept(membershipId);
  console.log(response);
  process.exit(0);
}

async function membershipRejectHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const membershipId = argv.membershipId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.membershipReject(membershipId);
  console.log(response);
  process.exit(0);
}

async function membershipRevokeHandler(argv) {
  const { wallet, jwtToken } = await loadCredentials();
  const membershipId = argv.membershipId;

  const akord = await Akord.init(config, wallet, jwtToken);
  const response = await akord.membershipRevoke(membershipId);
  console.log(response);
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
  walletCognitoHandler,
  walletGenerateHandler,
  walletImportHandler,
  walletRecoverHandler,
  configureHandler,
}