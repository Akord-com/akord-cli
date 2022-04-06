const Arweave = require('arweave');
const { apiConfig } = require('./api-config');

// Set up Arweave client
const arweave = Arweave.init(apiConfig());

async function prepareArweaveTransaction(data, tags, wallet) {
  try {
    // create a new arweave transaction with data & tags
    let transaction = await arweave.createTransaction({
      data: data
    }, wallet)
    for (const [key, value] of Object.entries(tags)) {
      transaction.addTag(key, value);
    }
    // sign the new transaction
    await arweave.transactions.sign(transaction, wallet);
    return transaction;
  } catch (error) {
    console.log("in arweave.js: Could not create an Arweave transaction: " + error);
    throw new Error("Could not create an Arweave transaction: " + error);
  }
};

async function uploadChunksArweaveTransaction(transaction) {
  try {
    const uploader = await arweave.transactions.getUploader(transaction);
    while (!uploader.isComplete) {
      await uploader.uploadChunk();
      console.log(`${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`);
    }
  } catch (error) {
    console.log("Could not post the transaction to the Arweave blockchain: " + error);
    throw new Error("Could not post the transaction to the Arweave blockchain: " + error);
  }
};

async function postArweaveTransaction(transaction) {
  try {
    await arweave.transactions.post(transaction);
  } catch (error) {
    throw new Error("Could not post the transaction to the Arweave blockchain: " + error);
  }
};

async function getPublicKeyFromAddress(address) {
  try {
    const transactionId = await arweave.wallets.getLastTransactionID(address);
    if (transactionId) {
      const transaction = await arweave.transactions.get(transactionId);
      return transaction.owner
    } else {
      console.log("Could not find corresponding public key for the given address. Make sure that the member address is registered on the weave, ie. at least one transaction was made with that address.");
    }
  } catch (error) {
    console.log("Could not find corresponding public key for the given address. Make sure that the member address is registered on the weave, ie. at least one transaction was made with that address.");
    console.error("Could not find corresponding public key for the given address: " + error);
  }
};

const mine = () => arweave.api.get("mine");

module.exports = {
  arweave,
  prepareArweaveTransaction,
  uploadChunksArweaveTransaction,
  postArweaveTransaction,
  getPublicKeyFromAddress,
  mine
}