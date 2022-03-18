const { SmartWeaveNodeFactory, LoggerFactory } = require("redstone-smartweave");
const { arweave } = require("./arweave-helpers");
const { tags } = require('./constants');
const { protocolName, protocolVersion, appName, pstContractTxId } = require('./config');
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');

// Set up SmartWeave client
LoggerFactory.INST.logLevel('error');
const smartweave = SmartWeaveNodeFactory.memCached(arweave)

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
        // const accessToken = result.getAccessToken().getJwtToken();
        cognitoUser.getUserAttributes(async function (err, result) {
          if (err) {
            console.log(err.message || JSON.stringify(err));
            return reject;
          }
          console.log('attributes: ' + result);
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
    const txId = await contract.writeInteraction(input, getTagsFromObject(tags), pstTransfer, true);
    return { txId, pstTransfer }
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
    [tags.CLIENT_NAME]: appName,
    [tags.PROTOCOL_NAME]: protocolName,
    [tags.PROTOCOL_VERSION]: protocolVersion,
    [tags.TIMESTAMP]: Date.now(),
  }
}

module.exports = {
  getContract,
  deployContract,
  postContractTransaction,
  getTagsFromObject,
  initContract,
  constructHeader,
  getEncryptedBackupPhraseFromCognito
}