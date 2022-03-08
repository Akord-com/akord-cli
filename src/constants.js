exports.svpTags = {
  CLIENT_NAME: "Client-Name",
  PROTOCOL_NAME: "Protocol-Name",
  PROTOCOL_VERSION: "Protocol-Version",
  TIMESTAMP: "Timestamp",
  SCHEMA_URI: "Schema-Uri",
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
  VAULT_CREATE: "svp:vault:create",
  VAULT_UPDATE: "svp:vault:update",
  VAULT_ARCHIVE: "svp:vault:archive",
  VAULT_RESTORE: "svp:vault:restore",
  MEMBERSHIP_INVITE: "svp:membership:invite",
  MEMBERSHIP_ACCEPT: "svp:membership:accept",
  MEMBERSHIP_REVOKE: "svp:membership:revoke",
  MEMBERSHIP_REJECT: "svp:membership:reject",
  MEMBERSHIP_UPDATE: "svp:membership:update",
  STACK_CREATE: "svp:stack:create",
  STACK_UPDATE: "svp:stack:update",
  STACK_REVOKE: "svp:stack:revoke",
  STACK_MOVE: "svp:stack:move",
  STACK_RESTORE: "svp:stack:restore",
  STACK_DELETE: "svp:stack:delete",
  FOLDER_CREATE: "svp:folder:create",
  FOLDER_UPDATE: "svp:folder:update",
  FOLDER_REVOKE: "svp:folder:revoke",
  FOLDER_MOVE: "svp:folder:move",
  FOLDER_RESTORE: "svp:folder:restore",
  FOLDER_DELETE: "svp:folder:delete",
  MEMO_CREATE: "svp:memo:create"
};