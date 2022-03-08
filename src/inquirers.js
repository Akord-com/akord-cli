const inquirer = require('inquirer');

const askForFilePath = async () => {
  return inquirer.prompt([
    {
      name: 'filePath',
      type: 'input',
      message: `Type path to the file to be uploaded:`,
    },
  ]);
};

const askForTransactionId = async () => {
  return inquirer.prompt([
    {
      name: 'transactionId',
      type: 'input',
      message: `Type transaction id for the file stack to be referenced:`,
    },
  ]);
};

const askForAccessType = async () => {
  return inquirer
    .prompt([
      {
        type: 'list',
        name: 'accessType',
        message: 'Choose who can access your file:',
        choices: [
          'public', 'private',
        ],
        default: 'private'
      },
    ]);
};

const askForStackName = async (name) => {
  return inquirer.prompt([
    {
      name: 'stackName',
      type: 'input',
      message: `Type stack name:`,
      default: name,
    },
  ]);
};

const askForUploadType = async () => {
  return inquirer
    .prompt([
      {
        type: 'list',
        name: 'uploadType',
        message: 'How would you like to upload your file?',
        choices: [
          'file path', 'transaction id',
        ],
        default: 'file path'
      },
    ]);
};

module.exports = {
  askForFilePath,
  askForTransactionId,
  askForAccessType,
  askForStackName,
  askForUploadType
}