const { codeSources } = require("./config");
const { tags: protocolTags } = require("./constants");
const { postContractTransaction, initContract } = require("./helpers");
const { verifyString, deriveAddress } = require("./crypto/crypto-helpers");
const contractSrcPostfix = "-Contract-Src";
const fs = require('fs');
const { base64ToArray } = require("./crypto/encoding-helpers");
const os = require('os');

function loadWallet() {
  const userWallet = JSON.parse(fs.readFileSync(os.homedir() + "/.akord").toString());
  if (userWallet.mnemonic) {
    const wallet = fs.readFileSync("./arweave-keyfile1.json").toString();
    return JSON.parse(wallet);
  } else {
    return userWallet;
  }
}

function initContractId(objectType, tags) {
  const wallet = loadWallet();
  return initContract(codeSources[objectType + contractSrcPostfix], tags, wallet);
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
  await validateSignature(input, tags);
  tags[protocolTags.SIGNATURE] = input.signature;
  return postContractTransaction(
    contractId,
    { function: "write", header: input.header, body: input.body },
    tags,
    wallet
  );
}

module.exports = {
  initContractId,
  postTransaction
}