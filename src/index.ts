#!/usr/bin/env node

import yargs, { CommandModule } from 'yargs';
import {
  vaultCreateHandler,
  vaultRenameHandler,
  vaultArchiveHandler,
  vaultRestoreHandler,
  manifestGenerateHandler,
  syncHandler,
  stackCreateHandler,
  stackImportHandler,
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
  loginHandler,
  signupHandler,
  vaultListHandler,
  vaultGetHandler,
  membershipListHandler,
  stackListHandler,
  stackGetHandler,
  folderListHandler,
  folderGetHandler,
  stackDownloadHandler,
  diffHandler,
  displayError
} from './handlers';
import './polyfill'
import { logger, muteSpinner } from './logger';

const loginCommand = {
  command: 'login <email>',
  describe: 'login & import the Akord wallet',
  builder: () => {
    yargs
      .positional('email', { describe: 'email' })
      .option("p", {
        alias: "password",
        describe: "user password",
        default: undefined
      })
      .option("t", {
        alias: "token",
        describe: "return issued token",
        default: false
      })
  },
  handler: loginHandler,
};

const signupCommand = {
  command: 'signup <email>',
  describe: 'signup & generate the Akord wallet',
  builder: () => {
    yargs
      .positional('email', { describe: 'email' })
      .option("p", {
        alias: "password",
        describe: "user password"
      })
  },
  handler: signupHandler,
};

const vaultCreateCommand = {
  command: 'vault:create <name>',
  describe: 'create a new vault',
  builder: () => {
    yargs
      .positional('name', { describe: 'name for the new vault' })
      .option('description', {
        type: "string",
        describe: 'a description for your vault',
        default: null
      })
      .option('terms', {
        type: "string",
        describe: 'if the vault is intended for professional or legal use, you can add terms of access and they must be digitally signed before accessing the vault',
        default: null
      })
      .option("public", {
        type: "boolean",
        default: false,
        describe: "set public vault context, default to private vault"
      })
      .option("cloud", {
        type: "boolean",
        default: false,
        describe: "set cloud vault context, default to permanent (arweave) vault"
      })
  },
  handler: vaultCreateHandler,
};

const vaultRenameCommand = {
  command: 'vault:rename <vaultId> <name>',
  describe: 'update vault name',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
      .positional('name', { describe: 'new name for the vault' })
  },
  handler: vaultRenameHandler,
};

const vaultArchiveCommand = {
  command: 'vault:archive <vaultId>',
  describe: 'archive the vault',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
  },
  handler: vaultArchiveHandler,
};

const vaultRestoreCommand = {
  command: 'vault:restore <vaultId>',
  describe: 'restore the vault',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
  },
  handler: vaultRestoreHandler,
};

const manifestGenerateCommand = {
  command: 'manifest:generate <vaultId>',
  describe: 'generate a path manifest for the vault',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
  },
  handler: manifestGenerateHandler,
};

const stackCreateCommand = {
  command: 'stack:create <vaultId>',
  describe: 'create a new stack from a file path',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
      .option("f", {
        alias: "file-path",
        describe: "file path"
      })
      .option("t", {
        alias: "file-type",
        describe: "file mime type, default to the mime type retrieved from provided file path",
        default: undefined
      })
      .option("n", {
        alias: "file-name",
        describe: "file name, default to the file name from provided file path",
        default: undefined
      })
      .option("n", {
        alias: "name",
        describe: "name for the new stack, default to the file name"
      })
      .option("p", {
        alias: "parent-id",
        describe: "parent folder id, if null: root folder"
      })
  },
  handler: stackCreateHandler,
};

const stackImportCommand = {
  command: 'stack:import <vaultId> <fileTxId>',
  describe: 'create a new stack from an existing arweave transaction',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
      .positional('fileTxId', { describe: 'arweave file transaction id reference' })
      .option("p", {
        alias: "parent-id",
        describe: "parent folder id, if null: root folder"
      })
  },
  handler: stackImportHandler,
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
      .option("t", {
        alias: "file-type",
        describe: "file mime type, default to the mime type retrieved from provided file path",
        default: undefined
      })
      .option("n", {
        alias: "file-name",
        describe: "file name, default to the file name from provided file path",
        default: undefined
      })
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

const diffCommand = {
  command: 'diff <source> <destination>',
  describe: 'check diff between local dir or S3 bucket and Akord vault',
  builder: () => {
    yargs
      .positional('source', { describe: 'source storage used in diff check. supported storages: file system e.g. ".", S3 bucket e.g. "s3://my-bucket" or akord storage e.g. "akord://my-vault-id"' })
      .positional('destination', { describe: 'destination storage used in diff check. supported storages: file system e.g. ".", S3 bucket e.g. "s3://my-bucket" or akord storage e.g. "akord://my-vault-id"' })
  },
  handler: diffHandler,
};

const syncCommand = {
  command: 'sync <source> <destination>',
  describe: 'sync local dir or S3 bucket with Akord vault',
  builder: () => {
    yargs
      .positional('source', { describe: 'source storage used in synchronisation. supported storages: file system e.g. ".", S3 bucket e.g. "s3://my-bucket" or akord storage e.g. "akord://my-vault-id"' })
      .positional('destination', { describe: 'destination storage used in synchronisation. supported storages: file system e.g. ".", S3 bucket e.g. "s3://my-bucket" or akord storage e.g. "akord://my-vault-id"' })
      .option("a", {
        type: 'boolean',
        default: false,
        alias: "auto-approve",
        describe: "Skips confirmation step. False by default"
      })
      .option("r", {
        type: 'boolean',
        default: true,
        alias: "recursive",
        describe: "Recursively compares storages (includes files from directories, subdirectories etc.) True by default"
      })
      .option("d", {
        type: 'boolean',
        default: false,
        alias: "delete",
        describe: "Deletes files non existing in source storage from target storage. False by default"
      })
      .option("e", {
        type: 'boolean',
        default: false,
        alias: "include-empty-dirs",
        describe: "Empty directories are recreated/deleted. False by default"
      })
      .option("-h", {
        type: 'boolean',
        default: false,
        alias: "include-hidden",
        describe: "Include hidden directories & files. False by default"
      })
  },
  handler: syncHandler,
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
  command: 'membership:invite <vaultId> <email>',
  describe: 'invite a new member to the vault',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
      .positional('email', { describe: 'invitee email address' })
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

const vaultListCommand = {
  command: 'vault:list',
  describe: 'list all user vaults',
  builder: () => { },
  handler: vaultListHandler,
};

const vaultGetCommand = {
  command: 'vault:get <vaultId>',
  describe: 'get vault by id',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
  },
  handler: vaultGetHandler,
};

const stackListCommand = {
  command: 'stack:list <vaultId>',
  describe: 'list all stacks within the given vault',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
  },
  handler: stackListHandler,
};

const folderListCommand = {
  command: 'folder:list <vaultId>',
  describe: 'list all folders within the given vault',
  builder: () => {
    yargs
      .positional('vaultId', { describe: 'vault id' })
  },
  handler: folderListHandler,
};

const folderGetCommand = {
  command: 'folder:get <folderId>',
  describe: 'get folder by id',
  builder: () => {
    yargs
      .positional('folderId', { describe: 'folder id' })
  },
  handler: folderGetHandler,
};

const stackGetCommand = {
  command: 'stack:get <stackId>',
  describe: 'get stack by id',
  builder: () => {
    yargs
      .positional('stackId', { describe: 'stack id' })
  },
  handler: stackGetHandler,
};

const membershipListCommand = {
  command: 'membership:list <vaultId>',
  describe: 'list all active members within the given vault',
  builder: () => {
    yargs
      .positional('membershipId', { describe: 'membership id' })
  },
  handler: membershipListHandler,
};

const stackDownloadCommand = {
  command: 'stack:download <stackId>',
  describe: 'download latest file stack version',
  builder: () => {
    yargs
      .positional('stackId', { describe: 'stack id' })
      .option("v", {
        type: 'number',
        alias: "file-version",
        describe: "file version",
        default: undefined
      })
      .option("f", {
        alias: "file-path",
        describe: "file path"
      })
      .option("o", {
        type: 'boolean',
        alias: "override",
        describe: "override content for the given file path",
        default: false
      })
  },
  handler: stackDownloadHandler,
};

yargs
  .command(<CommandModule><unknown>loginCommand)
  .command(<CommandModule><unknown>signupCommand)
  .command(<CommandModule><unknown>vaultCreateCommand)
  .command(<CommandModule><unknown>vaultRenameCommand)
  .command(<CommandModule><unknown>vaultArchiveCommand)
  .command(<CommandModule><unknown>vaultRestoreCommand)
  .command(<CommandModule><unknown>vaultGetCommand)
  .command(<CommandModule><unknown>vaultListCommand)
  .command(<CommandModule><unknown>manifestGenerateCommand)
  .command(<CommandModule><unknown>diffCommand)
  .command(<CommandModule><unknown>syncCommand)
  .command(<CommandModule><unknown>stackCreateCommand)
  .command(<CommandModule><unknown>stackImportCommand)
  .command(<CommandModule><unknown>stackRenameCommand)
  .command(<CommandModule><unknown>stackUploadRevisionCommand)
  .command(<CommandModule><unknown>stackMoveCommand)
  .command(<CommandModule><unknown>stackRevokeCommand)
  .command(<CommandModule><unknown>stackRestoreCommand)
  .command(<CommandModule><unknown>stackDeleteCommand)
  .command(<CommandModule><unknown>stackGetCommand)
  .command(<CommandModule><unknown>stackListCommand)
  .command(<CommandModule><unknown>stackDownloadCommand)
  .command(<CommandModule><unknown>memoCreateCommand)
  .command(<CommandModule><unknown>folderCreateCommand)
  .command(<CommandModule><unknown>folderMoveCommand)
  .command(<CommandModule><unknown>folderRenameCommand)
  .command(<CommandModule><unknown>folderRevokeCommand)
  .command(<CommandModule><unknown>folderRestoreCommand)
  .command(<CommandModule><unknown>folderDeleteCommand)
  .command(<CommandModule><unknown>folderGetCommand)
  .command(<CommandModule><unknown>folderListCommand)
  .command(<CommandModule><unknown>membershipInviteCommand)
  .command(<CommandModule><unknown>membershipAcceptCommand)
  .command(<CommandModule><unknown>membershipRejectCommand)
  .command(<CommandModule><unknown>membershipRevokeCommand)
  .command(<CommandModule><unknown>membershipListCommand)
  .demandCommand()
  .option("verbose", {
    type: 'boolean',
    default: true,
    alias: "verbose",
    describe: "Prints output messages to stdout"
  })
  .middleware((argv) => {
    if (!argv.verbose) {
      muteSpinner()
    }
  })
  .middleware((argv) => logger.debug("Executed command: " + JSON.stringify(argv)))
  .fail(displayError)
  .help()
  .wrap(100)
  .argv;
