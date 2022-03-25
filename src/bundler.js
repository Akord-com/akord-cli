const { codeSources } = require("./config");
const { postContractTransaction, initContract } = require("./helpers");
const contractSrcPostfix = "-Contract-Src";
const fs = require('fs');

function loadWallet(type) {
  let path;
  if(type === "bundler") {
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

async function postTransaction(contractId, input, tags) {
  const wallet = loadWallet("bundler");
  return postContractTransaction(
    contractId,
    input,
    tags,
    wallet
  );
}

module.exports = {
  initContractId,
  postTransaction
}