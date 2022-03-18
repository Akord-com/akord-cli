exports.tags = {
  CLIENT_NAME: "Client-Name",
  PROTOCOL_NAME: "Protocol-Name",
  PROTOCOL_VERSION: "Protocol-Version",
  TIMESTAMP: "Timestamp",
  COMMAND: "Command",
  VAULT_CONTRACT_ID: "Vault-Contract-Id",
  MEMBERSHIP_CONTRACT_ID: "Membership-Contract-Id",
  OBJECT_CONTRACT_TYPE: "Object-Contract-Type",
  OBJECT_CONTRACT_ID: "Object-Contract-Id",
  ACCESS: "Access",
  REF_ID: "Ref-Id",
  REVISION: "Revision",
  ACTION_REF: "Action-Ref",
  GROUP_REF: "Group-Ref",
  SIGNER_ADDRESS: "Signer-Address",
  MEMBER_ADDRESS: "Member-Address"
};

exports.smartweaveTags = {
  APP_NAME: "App-Name",
  APP_VERSION: "App-Version",
  CONTENT_TYPE: "Content-Type",
  CONTRACT: "Contract",
  CONTRACT_SOURCE: "Contract-Src",
  INPUT: "Input",
  INTERACT_WRITE: "Interact-Write",
};

exports.smartweaveValues = {
  CONTRACT_CODE_SOURCE: "SmartWeaveContractSource",
  CONTRACT_INTERACTION: "SmartWeaveAction",
  CONTRACT_INITIALIZATION: "SmartWeaveContract"
};

exports.objectTypes = {
  VAULT: "Vault",
  MEMBERSHIP: "Membership",
  STACK: "Stack",
  MEMO: "Memo",
  FOLDER: "Folder"
};

exports.status = {
  PENDING: "PENDING",
  INVITED: "INVITED",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  REVOKED: "REVOKED",
  ACTIVE: "ACTIVE",
  REVOKED: "REVOKED",
  ARCHIVED: "ARCHIVED",
  DELETED: "DELETED"
};

exports.role = {
  OWNER: "OWNER",
  CONTRIBUTOR: "CONTRIBUTOR",
  VIEWER: "VIEWER"
};

exports.commands = {
  VAULT_CREATE: "vault:create",
  VAULT_UPDATE: "vault:update",
  VAULT_ARCHIVE: "vault:archive",
  VAULT_RESTORE: "vault:restore",
  MEMBERSHIP_INVITE: "membership:invite",
  MEMBERSHIP_ACCEPT: "membership:accept",
  MEMBERSHIP_REVOKE: "membership:revoke",
  MEMBERSHIP_REJECT: "membership:reject",
  MEMBERSHIP_UPDATE: "membership:update",
  STACK_CREATE: "stack:create",
  STACK_UPDATE: "stack:update",
  STACK_REVOKE: "stack:revoke",
  STACK_MOVE: "stack:move",
  STACK_RESTORE: "stack:restore",
  STACK_DELETE: "stack:delete",
  FOLDER_CREATE: "folder:create",
  FOLDER_UPDATE: "folder:update",
  FOLDER_REVOKE: "folder:revoke",
  FOLDER_MOVE: "folder:move",
  FOLDER_RESTORE: "folder:restore",
  FOLDER_DELETE: "folder:delete",
  MEMO_CREATE: "memo:create"
};