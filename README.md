# akord-cli
Akord Command Line Interface - simply interact with Akord from the terminal.

The CLI is a set of Akord commands for creating vaults, adding members, creating new stacks, etc.\
The CLI uses [Akord Client](https://www.npmjs.com/package/@akord/akord-js) to create the encryption context and handle transaction formatting.\
Each command is an interaction with the Akord Vault Protocol.

## Getting started
### Installation
> requires Node.js 16
```
yarn global add @akord/akord-cli
```
### Usage
First configure the CLI with your Akord account
```
akord login <email>
```
Now let's create our first vault and upload our first file to a folder by following these few simple steps
```
akord vault:create "my first vault"
akord folder:create <vaultId> "my first folder"
akord stack:create <vaultId> --file-path "./image.jpeg" --parent-id <folderId>
```

## Akord CLI Commands
```
     _      _                         _
    / \    | | __   ___    _ __    __| |
   / _ \   | |/ /  / _ \  | '__|  / _` |
  / ___ \  |   <  | (_) | | |    | (_| |
 /_/   \_\ |_|\_\  \___/  |_|     \__,_|

akord <command>

Commands:
  akord login <email>                       login & import the Akord wallet
  akord signup <email>                      signup & generate the Akord wallet

  akord vault:create <name> [terms]         create a new vault
  akord vault:rename <vaultId> <name>       update vault name
  akord vault:archive <vaultId>             archive the vault
  akord vault:restore <vaultId>             restore the vault
  akord vault:get <vaultId>                 get vault by id
  akord vault:list                          list all user vaults

  akord stack:create <vaultId>              create a new stack
  akord stack:rename <stackId> <name>       rename the stack
  akord stack:upload-revision <stackId>     upload new file version to the stack
  akord stack:move <stackId> <parentId>     move the stack
  akord stack:revoke <stackId>              revoke the stack
  akord stack:restore <stackId>             restore the stack
  akord stack:delete <stackId>              delete the stack
  akord stack:get <stackId>                 get stack by id
  akord stack:list <vaultId>                list all stacks within the given
                                            vault
  akord stack:download <stackId>            download latest file stack version

  akord memo:create <vaultId> <message>     create a new memo

  akord folder:create <vaultId> <name>      create a new folder
  [parentId]
  akord folder:move <folderId> <parentId>   move the folder
  akord folder:rename <folderId> <name>     rename the folder
  akord folder:revoke <folderId>            revoke the folder
  akord folder:restore <folderId>           restore the folder
  akord folder:delete <folderId>            delete the folder
  akord folder:get <folderId>               get folder by id
  akord folder:list <vaultId>               list all folders within the given
                                            vault

  akord membership:invite <vaultId>         invite a new member to the vault
  <email>
  akord membership:accept <membershipId>    accept the invitation to the vault
  akord membership:reject <membershipId>    reject the invitation to the vault
                                            or leave the vault
  akord membership:revoke <membershipId>    revoke the membership
  akord membership:list <vaultId>           list all active members within the
                                            given vault

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]
```

## Development
```
yarn install
yarn build
yarn local
```

## Contributing

Please use [semantic commit messages](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716)
