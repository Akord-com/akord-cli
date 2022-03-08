const { SmartWeaveNodeFactory, LoggerFactory } = require("redstone-smartweave");
const { arweave } = require("./arweave-helpers");
const { svpTags } = require('./constants');
const { protocolName, protocolVersion, appName, pstContractTxId } = require('./config');

// Set up SmartWeave client
LoggerFactory.INST.logLevel('error');
const smartweave = SmartWeaveNodeFactory.memCached(arweave)

const getContract = (contractTxId, wallet) => {
  return smartweave
    .contract(contractTxId)
    .setEvaluationOptions({
      internalWrites: true,
      fcpOptimization: true,
      stackTrace: {
        saveState: true
      }
    })
    .connect(wallet);
};

const getTagsFromObject = (object) => {
  let tags = [];
  for (let key in object) {
    if (object.hasOwnProperty(key)) {
      tags.push({ name: key, value: object[key] });
    }
  }
  return tags;
};

async function deployContract(contractCodeSourceTxId, contractInitStateJSON, tags, wallet) {
  const initialState = JSON.stringify(contractInitStateJSON);
  const contractTxId = await smartweave.createContract.deployFromSourceTx({
    wallet,
    initState: initialState,
    srcTxId: contractCodeSourceTxId,
    tags
  });
  return contractTxId;
}

async function preparePstRewardTransfer(wallet) {
  const contract = getContract(pstContractTxId, wallet);
  const currentState = await contract.readState();
  const holder = selectWeightedPstHolder(currentState.state);
  return {
    target: holder,
    winstonQty: 0.15
  }
}

function selectWeightedPstHolder(state) {
  const balances = state.balances;
  const vault = state.vault;
  let total = 0;
  for (const addr of Object.keys(balances)) {
    total += balances[addr];
  }
  for (const addr of Object.keys(vault)) {
    if (!vault[addr].length) continue;
    const vaultBalance = vault[addr]
      .map((a) => a.balance)
      .reduce((a, b) => a + b, 0);
    total += vaultBalance;
    if (addr in balances) {
      balances[addr] += vaultBalance;
    } else {
      balances[addr] = vaultBalance;
    }
  }
  const weighted = {};
  for (const addr of Object.keys(balances)) {
    weighted[addr] = balances[addr] / total;
  }
  const randomHolder = weightedRandom(weighted);
  return randomHolder;
}

function weightedRandom(dict) {
  let sum = 0;
  const r = Math.random();
  for (const addr of Object.keys(dict)) {
    sum += dict[addr];
    if (r <= sum && dict[addr] > 0) {
      return addr;
    }
  }
  return;
}

async function postContractTransaction(contractId, input, tags, wallet) {
  try {
    const contract = getContract(contractId, wallet);
    const pstTransfer = await preparePstRewardTransfer(wallet);
    return contract.writeInteraction(input, getTagsFromObject(tags), pstTransfer, true);
  } catch (error) {
    console.log(error)
    throw new Error("Cannot perform the operation: " + error);
  }
}

const initContract = async (contractSrc, additionalTags, wallet) => {
  const tags = getTagsFromObject(constructHeader(additionalTags));
  const contractTxId = await deployContract(contractSrc, {}, tags, wallet);
  return contractTxId;
}

function constructHeader(headerPayload) {
  return {
    ...(headerPayload ? headerPayload : {}),
    [svpTags.CLIENT_NAME]: appName,
    [svpTags.PROTOCOL_NAME]: protocolName,
    [svpTags.PROTOCOL_VERSION]: protocolVersion,
    [svpTags.TIMESTAMP]: Date.now(),
  }
}

module.exports = {
  getContract,
  deployContract,
  postContractTransaction,
  getTagsFromObject,
  initContract,
  constructHeader,
}