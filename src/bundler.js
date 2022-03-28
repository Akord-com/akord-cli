const { codeSources } = require("./config");
const { postContractTransaction, initContract } = require("./helpers");
const { verifyString, deriveAddress } = require("./crypto/crypto-helpers");
const contractSrcPostfix = "-Contract-Src";
const fs = require('fs');
const { base64ToArray } = require("./crypto/encoding-helpers");

function loadWallet(type) {
  let path;
  if (type === "bundler") {
    path = './arweave-keyfile1.json';
  } else {
    path = '~/.akord';
  }
  const wallet = fs.readFileSync(path).toString();
  return JSON.parse(wallet);
}

function initContractId(objectType, tags) {
  const wallet = loadWallet("bundler");
  return initContract(codeSources[objectType + contractSrcPostfix], tags, wallet);
}

async function validateSignature(input, tags) {
  console.log(input)
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
  if (signerAddress !== tags["Signer-Address"]) {
    console.error("Invalid signer");
    throw new Error("Invalid signer.");
  }
}

async function postTransaction(contractId, input, tags) {
  const wallet = loadWallet("bundler");
  await validateSignature(input, tags);
  tags["Signature"] = input.signature;
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