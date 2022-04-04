const { codeSources, adminContractTxId } = require("./config");
const { tags: protocolTags } = require("./constants");
const { prepareArweaveTransaction, uploadChunksArweaveTransaction } = require("./arweave-helpers");
const { postContractTransaction, initContract, getContract } = require("./helpers");
const { verifyString, deriveAddress } = require("./crypto/crypto-helpers");
const contractSrcPostfix = "-Contract-Src";
const fs = require('fs');
const { base64ToArray } = require("./crypto/encoding-helpers");
const os = require('os');
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');
const users = require('./users.json');

const adminAddress = "uDUlT10M9Krtz7CHdr9c9_ePKp5IP0vwH60pauzsyDY";

function loadWallet() {
  const userWallet = JSON.parse(fs.readFileSync(os.homedir() + "/.akord").toString());
  if (userWallet.mnemonic) {
    const wallet = fs.readFileSync("./admin-mock-keyfile.json").toString();
    return JSON.parse(wallet);
  } else {
    return userWallet;
  }
}

function isAdmin() {
  const userWallet = JSON.parse(fs.readFileSync(os.homedir() + "/.akord").toString());
  if (userWallet.mnemonic) return true;
  return false;
}

function initContractId(objectType, tags) {
  const wallet = loadWallet();
  const initialState = isAdmin() ? { adminContract: adminContractTxId } : {};
  return initContract(codeSources[objectType + contractSrcPostfix], tags, initialState, wallet);
}

async function validateSignature(input, tags) {
  const { header, body, publicKey, signature } = input;
  const verified = await verifyString(
    `${header}${body}`,
    publicKey,
    signature
  )
  if (!verified) {
    console.error("Invalid signature");
    throw new Error("Invalid signature.");
  }
  const signerAddress = await deriveAddress(base64ToArray(publicKey), "akord");
  if (signerAddress !== tags[protocolTags.SIGNER_ADDRESS]) {
    console.error("Invalid signer");
    throw new Error("Invalid signer.");
  }
}

async function postTransaction(contractId, input, tags) {
  const wallet = loadWallet();
  if (isAdmin()) {
    await validateSignature(input, tags);
  }
  tags[protocolTags.SIGNATURE] = input.signature;
  return postContractTransaction(
    contractId,
    { function: "write", header: input.header, body: input.body },
    tags,
    wallet
  );
}

async function uploadFile(file) {
  const wallet = loadWallet();
  const transaction = await prepareArweaveTransaction(
    file,
    { 'Content-Type': 'image/jpeg' },
    wallet
  );
  await uploadChunksArweaveTransaction(transaction);
  return transaction.id;
}

async function getContractState(contractId) {
  const wallet = loadWallet();
  const contract = getContract(contractId, wallet);
  return contract.readState();
}

async function getPublicKeyFromAddress(address) {
   let publicKey;
   Object.keys(users).map(function (key, index) {
     if (key === address) publicKey = users[key].publicKey
   });
   return base64ToArray(publicKey);
}

const getEncryptedBackupPhraseFromCognito = async (email, password) => {
  const authenticationData = {
    Username: email,
    Password: password,
  };
  const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
  const poolData = {
    UserPoolId: 'eu-central-1_FOAlZvgHo',
    ClientId: '3m7t2tk3dpldemk3geq0otrtt9'
  };
  const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
  const userData = {
    Username: email,
    Pool: userPool
  };
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: function (result) {
        cognitoUser.getUserAttributes(async function (err, result) {
          if (err) {
            console.log(err.message || JSON.stringify(err));
            return reject;
          }
          const attributes = result.reduce(function (
            attributesObject,
            attribute
          ) {
            attributesObject[attribute.Name] = attribute.Value;
            return attributesObject;
          }, {});
          resolve(attributes["custom:encBackupPhrase"]);
        });
      },
      onFailure: function (err) {
        console.log(err);
        return reject;
      },

    })
  }
  );
};

module.exports = {
  initContractId,
  postTransaction,
  uploadFile,
  getContractState,
  getPublicKeyFromAddress,
  getEncryptedBackupPhraseFromCognito
}