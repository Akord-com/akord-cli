#!/usr/bin/env node

import yargs, { CommandModule } from 'yargs';
import figlet from 'figlet';
import {
  vaultCreateHandler, vaultRenameHandler, vaultArchiveHandler, vaultRestoreHandler, stackCreateHandler, stackRenameHandler, stackRevokeHandler, stackRestoreHandler, stackUploadRevisionHandler, stackMoveHandler, stackDeleteHandler, memoCreateHandler, folderCreateHandler, folderRenameHandler, folderMoveHandler, folderRevokeHandler, folderRestoreHandler, folderDeleteHandler, membershipInviteHandler, membershipRevokeHandler, membershipAcceptHandler, membershipRejectHandler,
  walletCognitoHandler, walletGenerateHandler, walletImportHandler, walletRecoverHandler, configureHandler
} from './handlers';

console.log(
  figlet.textSync('Akord', { horizontalLayout: 'full' })
);

const configureCommand = {
  command: 'configure <env>',
  describe: 'configure the CLI',
  builder: () => {
    yargs
      .positional('env', { describe: 'choose the environment', choices: ['mainnet', 'testnet', 'local'] })
  },
  handler: configureHandler,
};

const walletGenerateCommand = {
  command: 'wallet:generate',
  describe: 'generate a new wallet & configure the CLI',
  builder: () => {
    yargs
  },
  handler: walletGenerateHandler,
};

const walletImportCommand = {
  command: 'wallet:import <key-file>',
  describe: 'configure the wallet with the JSON keyfile',
  builder: () => {
    yargs
      .positional('key-file', { describe: 'path to the JSON wallet key file' })
  },
  handler: walletImportHandler,
};

const walletCognitoCommand = {
  command: 'wallet:cognito <email> <password>',
  describe: 'import the mnemonic from cognito',
  builder: () => {
    yargs
      .positional('email', { describe: 'email' })
      .positional('password', { describe: 'password' })
  },
  handler: walletCognitoHandler,
};

const walletRecoverCommand = {
  command: 'wallet:recover <mnemonic>',
  describe: 'recover the wallet from the mnemonic',
  builder: () => {
    yargs
      .positional('mnemonic', { describe: '12-word seed phrase' })
  },
  handler: walletRecoverHandler,
};

const vaultCreateCommand = {
  command: 'vault:create <name> [terms]',
  describe: 'create a new vault',
  builder: () => {
    yargs
      .positional('name', { describe: 'name for the new vault' })
      .positional('terms', { describe: 'terms of access to the vault', default: null })
  },
  handler: vaultCreateHandler,
};

const vaultRenameCommand = {
  command: 'vault:rename <vaultId> <name>',
  describe: 'update vault name',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vauld id' })
      .positional('name', { describe: 'new name for the vault' })
  },
  handler: vaultRenameHandler,
};

const vaultArchiveCommand = {
  command: 'vault:archive <vaultId>',
  describe: 'archive the vault',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vauld id' })
  },
  handler: vaultArchiveHandler,
};

const vaultRestoreCommand = {
  command: 'vault:restore <vaultId>',
  describe: 'restore the vault',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vauld id' })
  },
  handler: vaultRestoreHandler,
};

const stackCreateCommand = {
  command: 'stack:create <vaultId>',
  describe: 'create a new stack',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
      .option("f", {
        alias: "file-path",
        describe: "file path"
      })
      .option("transaction-id", {
        alias: "transaction-id",
        describe: "id of the transaction with the file data"
      })
      .option('public', { type: 'boolean', default: false })
      .option("n", {
        alias: "name",
        describe: "name for the new stack, default to the file name"
      })
      .option("p", {
        alias: "parentId",
        describe: "parent folder id, if null: root folder"
      })
  },
  handler: stackCreateHandler,
};

const stackRenameCommand = {
  command: 'stack:rename <stackId> <name>',
  describe: 'rename the stack',
  builder: () => {
    yargs
      .positional('stackId', { describe: 'stack id' })
      .positional('name', { describe: 'new name for the stack' })
  },
  handler: stackRenameHandler,
};

const stackUploadRevisionCommand = {
  command: 'stack:upload-revision <stackId>',
  describe: 'upload new file version to the stack',
  builder: () => {
    yargs
      .positional('stackId', { describe: 'stack id' })
      .option("f", {
        alias: "file-path",
        describe: "file path"
      })
      .option("transaction-id", {
        alias: "transaction-id",
        describe: "id of the transaction with the file data"
      })
      .option('public', { type: 'boolean', default: false })
  },
  handler: stackUploadRevisionHandler,
};

const stackMoveCommand = {
  command: 'stack:move <stackId> <parentId>',
  describe: 'move the stack',
  builder: () => {
    yargs
      .positional('stackId', { describe: 'stack id' })
      .positional('parentId', { describe: 'parent folder id, if null: root folder' })
  },
  handler: stackMoveHandler,
};

const stackRevokeCommand = {
  command: 'stack:revoke <stackId>',
  describe: 'revoke the stack',
  builder: () => {
    yargs
      .positional('stackId', { describe: 'stack id' })
  },
  handler: stackRevokeHandler,
};

const stackRestoreCommand = {
  command: 'stack:restore <stackId>',
  describe: 'restore the stack',
  builder: () => {
    yargs
      .positional('stackId', { describe: 'stack id' })
  },
  handler: stackRestoreHandler,
};

const stackDeleteCommand = {
  command: 'stack:delete <stackId>',
  describe: 'delete the stack',
  builder: () => {
    yargs
      .positional('stackId', { describe: 'stack id' })
  },
  handler: stackDeleteHandler,
};

const memoCreateCommand = {
  command: 'memo:create <vaultId> <message>',
  describe: 'create a new memo',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
      .positional('message', { describe: 'memo content' })
  },
  handler: memoCreateHandler,
};

const folderCreateCommand = {
  command: 'folder:create <vaultId> <name> [parentId]',
  describe: 'create a new folder',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
      .positional('name', { describe: 'new name for the folder' })
      .positional('parentId', { describe: 'parent folder id, if null: root folder' })
  },
  handler: folderCreateHandler,
};

const folderRenameCommand = {
  command: 'folder:rename <folderId> <name>',
  describe: 'rename the folder',
  builder: () => {
    yargs
      .positional('folderId', { describe: 'folder id' })
      .positional('name', { describe: 'new name for the folder' })
  },
  handler: folderRenameHandler,
};

const folderMoveCommand = {
  command: 'folder:move <folderId> <parentId>',
  describe: 'move the folder',
  builder: () => {
    yargs
      .positional('folderId', { describe: 'folder id' })
      .positional('parentId', { describe: 'parent folder id, if null: root folder' })
  },
  handler: folderMoveHandler,
};

const folderRevokeCommand = {
  command: 'folder:revoke <folderId>',
  describe: 'revoke the folder',
  builder: () => {
    yargs
      .positional('folderId', { describe: 'folder id' })
  },
  handler: folderRevokeHandler,
};

const folderRestoreCommand = {
  command: 'folder:restore <folderId>',
  describe: 'restore the folder',
  builder: () => {
    yargs
      .positional('folderId', { describe: 'folder id' })
  },
  handler: folderRestoreHandler,
};

const folderDeleteCommand = {
  command: 'folder:delete <folderId>',
  describe: 'delete the folder',
  builder: () => {
    yargs
      .positional('folderId', { describe: 'folder id' })
  },
  handler: folderDeleteHandler,
};

const membershipInviteCommand = {
  command: 'membership:invite <vaultId> <address>',
  describe: 'invite a new member to the vault',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
      .positional('address', { describe: 'invitee address' })
      .option("r", {
        alias: "role",
        describe: "the role for the new member.",
        choices: ['CONTRIBUTOR', 'VIEWER']
      });
  },
  handler: membershipInviteHandler,
};

const membershipAcceptCommand = {
  command: 'membership:accept <membershipId>',
  describe: 'accept the invitation to the vault',
  builder: () => {
    yargs
      .positional('membershipId', { describe: 'membership id' })
  },
  handler: membershipAcceptHandler,
};

const membershipRejectCommand = {
  command: 'membership:reject <membershipId>',
  describe: 'reject the invitation to the vault or leave the vault',
  builder: () => {
    yargs
      .positional('membershipId', { describe: 'membership id' })
  },
  handler: membershipRejectHandler,
};

const membershipRevokeCommand = {
  command: 'membership:revoke <membershipId>',
  describe: 'revoke the membership',
  builder: () => {
    yargs
      .positional('membershipId', { describe: 'membership id' })
  },
  handler: membershipRevokeHandler,
};

yargs
  .command(<CommandModule><unknown>configureCommand)
  .command(<CommandModule><unknown>walletRecoverCommand)
  .command(<CommandModule><unknown>walletCognitoCommand)
  .command(<CommandModule><unknown>walletGenerateCommand)
  .command(<CommandModule><unknown>walletImportCommand)
  .command(<CommandModule><unknown>vaultCreateCommand)
  .command(<CommandModule><unknown>vaultRenameCommand)
  .command(<CommandModule><unknown>vaultArchiveCommand)
  .command(<CommandModule><unknown>vaultRestoreCommand)
  .command(<CommandModule><unknown>stackCreateCommand)
  .command(<CommandModule><unknown>stackRenameCommand)
  .command(<CommandModule><unknown>stackUploadRevisionCommand)
  .command(<CommandModule><unknown>stackMoveCommand)
  .command(<CommandModule><unknown>stackRevokeCommand)
  .command(<CommandModule><unknown>stackRestoreCommand)
  .command(<CommandModule><unknown>stackDeleteCommand)
  .command(<CommandModule><unknown>memoCreateCommand)
  .command(<CommandModule><unknown>folderCreateCommand)
  .command(<CommandModule><unknown>folderMoveCommand)
  .command(<CommandModule><unknown>folderRenameCommand)
  .command(<CommandModule><unknown>folderRevokeCommand)
  .command(<CommandModule><unknown>folderRestoreCommand)
  .command(<CommandModule><unknown>folderDeleteCommand)
  .command(<CommandModule><unknown>membershipInviteCommand)
  .command(<CommandModule><unknown>membershipAcceptCommand)
  .command(<CommandModule><unknown>membershipRejectCommand)
  .command(<CommandModule><unknown>membershipRevokeCommand)
  .demandCommand()
  .help()
  .argv;
