# akord-cli
Akord Command Line Interface - simply interact with the [Akord Vault Protocol](https://github.com/Akord-com/akord-protocol/blob/main/PROTOCOL_SPECIFICATION.md) from the terminal.

The CLI is a set of Akord commands for creating vaults, adding members, creating new stacks, etc.\
The CLI creates the encryption context and handles transaction formatting.\
Each command is an interaction with the Akord Vault Protocol.\
For each AVP interaction, a reward is distributed to the randomly selected $AKRD [Profit Sharing Token](https://github.com/Akord-com/akord-pst/) holder.

## Getting started
### Install the CLI
locally
```
yarn install
yarn build
yarn local
```
from the published package
```
yarn install -g akord-cli
```
### Interact with Akord API
First configure the CLI with your Akord account
```
akord login <email> <password>
```
Now let's create our first vault and upload our first file to a folder by following these few simple steps
```
akord vault:create "my first vault"
akord folder:create <vaultId> "my first folder"
akord stack:create <vaultId> --file-path "./image.jpeg" --parent-id <folderId>
```

### Interact directly with Arweave without Akord API
First configure the CLI with your wallet JSON keyfile
```
akord wallet:configure <path-to-wallet-keyfile>
```
or generate a new wallet
```
akord wallet:generate
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
  akord login <email> <password>            login & import the wallet
  akord configure <env>                     configure the CLI
  akord wallet:recover <mnemonic>           recover the wallet from the mnemonic
  akord wallet:generate                     generate a new wallet & configure
                                            the CLI
  akord wallet:import <key-file>            configure the wallet with the JSON
                                            keyfile
  akord vault:create <name> [terms]         create a new vault
  akord vault:rename <vaultId> <name>       update vault name
  akord vault:archive <vaultId>             archive the vault
  akord vault:restore <vaultId>             restore the vault

  akord stack:create <vaultId>              create a new stack
  akord stack:rename <stackId> <name>       rename the stack
  akord stack:upload-revision <stackId>     upload new file version to the stack
  akord stack:move <stackId>                move the stack
  <parentId>
  akord stack:revoke <stackId>              revoke the stack
  akord stack:restore <stackId>             restore the stack
  akord stack:delete <stackId>              delete the stack

  akord memo:create <vaultId> <message>     create a new memo

  akord folder:create <vaultId> <name>      create a new folder
  [parentId]
  akord folder:move <folderId>              move the folder
  <parentId>
  akord folder:rename <folderId> <name>     rename the folder
  akord folder:revoke <folderId>            revoke the folder
  akord folder:restore <folderId>           restore the folder
  akord folder:delete <folderId>            delete the folder

  akord membership:invite <vaultId>         invite a new member to the vault
  <address>
  akord membership:accept <membershipId>    accept the invitation to the vault
  akord membership:reject <membershipId>    reject the invitation to the vault
                                            or leave the vault
  akord membership:revoke <membershipId>    revoke the membership

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]
```