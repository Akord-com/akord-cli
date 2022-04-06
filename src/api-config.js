const fs = require('fs');
const os = require('os');

const apiConfig = () => {
  let config = {};
  let env;
  if (fs.existsSync(os.homedir() + "/.akord-cli-config")) {
    env = fs.readFileSync(os.homedir() + "/.akord-cli-config").toString();
  }
  switch (env) {
    case "mainnet": {
      config.host = 'arweave.net';
      config.port = 443;
      config.protocol = 'https';
      config.url = 'https://arweave.net';
      break
    }
    case "testnet": {
      config.host = 'testnet.redstone.tools';
      config.port = 443;
      config.protocol = 'https';
      config.url = 'https://testnet.redstone.tools';
      break
    }
    case "local": {
      config.host = 'localhost';
      config.port = 1984;
      config.protocol = 'http';
      config.url = 'http://localhost:1984';
      break
    }
    default: {
      config.host = 'testnet.redstone.tools';
      config.port = 443;
      config.protocol = 'https';
      config.url = 'https://testnet.redstone.tools';
      break
    }
  }
  return config;
};

module.exports = {
  apiConfig
}