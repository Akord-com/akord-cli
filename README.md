# akord-cli
Akord Command Line Interface - simply interact with the Akord Protocol from the terminal

## CLI Usage
```
npm install -g akord-cli
```
or
```
yarn add akord-cli
```

Create your first vault and upload your first file by following these few simple steps:
```
akord configure <path-to-wallet-keyfile>

akord vault:create "my first vault name"

akord stack:create <vaultId>
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
  akord configure <key-file>                setup wallet keyfile
  akord vault:create <name> [terms]         create a new vault
  akord vault:rename <vaultId> <name>       update vault name
  akord vault:archive <vaultId>             archive the vault
  akord vault:restore <vaultId>             restore the vault
  akord stack:create <vaultId>              create a new stack
  akord stack:rename <stackId> <name>       rename the stack
  akord stack:upload-revision <stackId>     upload new file version to the stack
  akord stack:move <stackId>                move the stack
  <parentFolderId>
  akord stack:revoke <stackId>              revoke the stack
  akord stack:restore <stackId>             restore the stack
  akord stack:delete <stackId>              delete the stack
  akord memo:create <vaultId> <message>     create a new memo
  akord folder:create <vaultId> <name>      create a new folder
  [parentFolderId]
  akord folder:move <folderId>              move the folder
  <parentFolderId>
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