import inquirer from 'inquirer';

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

const askForStackName = async (name: string): Promise<{ name: string }> => {
  return inquirer.prompt([
    {
      name: 'name',
      type: 'input',
      message: `Type stack name:`,
      default: name
    },
  ]);
};

const askForPassword = async (): Promise<{ password: string }> => {
  return inquirer.prompt([
    {
      name: 'password',
      type: 'password',
      message: `Type your password:`
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

const askForRole = async () => {
  return inquirer
    .prompt([
      {
        type: 'list',
        name: 'role',
        message: 'Choose a role for the new member',
        choices: [
          'CONTRIBUTOR', 'VIEWER',
        ],
        default: 'CONTRIBUTOR'
      },
    ]);
};

export {
  askForFilePath,
  askForTransactionId,
  askForStackName,
  askForUploadType,
  askForRole,
  askForPassword
}