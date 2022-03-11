#!/usr/bin/env node
'use strict';

const yargs = require('yargs');
const clear = require('clear');
const figlet = require('figlet');
const {
  vaultCreateHandler,
  vaultRenameHandler,
  vaultArchiveHandler,
  vaultRestoreHandler,
  stackCreateHandler,
  stackRenameHandler,
  stackRevokeHandler,
  stackRestoreHandler,
  stackUploadRevisionHandler,
  stackMoveHandler,
  stackDeleteHandler,
  memoCreateHandler,
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
  objectReadHandler,
  walletConfigureHandler,
  walletGenerateHandler,
  walletImportHandler
} = require('./handlers');

clear();
console.log(
  figlet.textSync('Akord', { horizontalLayout: 'full' })
);

const walletConfigureCommand = {
  command: 'wallet:configure <key-file>',
  describe: 'configure the wallet with the JSON keyfile',
  builder: () => {
    yargs
      .positional('key-file', { describe: 'path to the JSON wallet key file' })
  },
  handler: walletConfigureHandler,
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
  command: 'wallet:import <mnemonic>',
  describe: 'import the wallet from the mnemonic',
  builder: () => {
    yargs
      .positional('mnemonic', { describe: '12-word seed phrase' })
  },
  handler: walletImportHandler,
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
      .option('public', { type: 'boolean', default: false })
      .positional('transactionId', { describe: 'id of the transaction with the file data' })
      .positional('filePath', { describe: 'id of the transaction with the file data' })
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
  },
  handler: stackUploadRevisionHandler,
};

const stackMoveCommand = {
  command: 'stack:move <stackId> <parentFolderId>',
  describe: 'move the stack',
  builder: () => {
    yargs
      .positional('stackId', { describe: 'stack id' })
      .positional('parentFolderId', { describe: 'parent folder id, if null: root folder' })
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
  command: 'folder:create <vaultId> <name> [parentFolderId]',
  describe: 'create a new folder',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
      .positional('name', { describe: 'new name for the folder' })
      .positional('parentFolderId', { describe: 'parent folder id, if null: root folder' })
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
  command: 'folder:move <folderId> <parentFolderId>',
  describe: 'move the folder',
  builder: () => {
    yargs
      .positional('folderId', { describe: 'folder id' })
      .positional('parentFolderId', { describe: 'parent folder id, if null: root folder' })
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

const objectReadCommand = {
  command: 'object:read <objectId>',
  describe: 'compute & decrypt the current object state',
  builder: () => {
    yargs
      .positional('objectId', { describe: 'object id' })
  },
  handler: objectReadHandler,
};

yargs
  .command(walletConfigureCommand)
  .command(walletGenerateCommand)
  .command(walletImportCommand)
  .command(vaultCreateCommand)
  .command(vaultRenameCommand)
  .command(vaultArchiveCommand)
  .command(vaultRestoreCommand)
  .command(stackCreateCommand)
  .command(stackRenameCommand)
  .command(stackUploadRevisionCommand)
  .command(stackMoveCommand)
  .command(stackRevokeCommand)
  .command(stackRestoreCommand)
  .command(stackDeleteCommand)
  .command(memoCreateCommand)
  .command(folderCreateCommand)
  .command(folderMoveCommand)
  .command(folderRenameCommand)
  .command(folderRevokeCommand)
  .command(folderRestoreCommand)
  .command(folderDeleteCommand)
  .command(membershipInviteCommand)
  .command(membershipAcceptCommand)
  .command(membershipRejectCommand)
  .command(membershipRevokeCommand)
  .command(objectReadCommand)
  .demandCommand()
  .help()
  .argv;
