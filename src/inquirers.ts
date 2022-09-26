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

const askForCode = async (): Promise<{ code: string }> => {
  return inquirer.prompt([
    {
      name: 'code',
      type: 'input',
      message: `Type verification code:`
    },
  ]);
};

const askForTermsOfServiceAndPrivacyPolicy = async (): Promise<{ terms: boolean }> => {
  return inquirer.prompt([
    {
      name: 'terms',
      type: 'confirm',
      message: `I have read and agree to the Terms of Service: \nhttps://akord.com/terms-of-service-consumer\n\nand Privacy Policy: \nhttps://akord.com/privacy-policy\n`
    },
  ]);
};

const askForWaiveOfWithdrawalRight = async (): Promise<{ withdrawal: boolean }> => {
  return inquirer.prompt([
    {
      name: 'withdrawal',
      type: 'confirm',
      message: `I agree to waive my withdrawal right, if applicable: \nhttps://docs.akord.com/v/app-docs/legal/2022\n`
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
  askForPassword,
  askForCode,
  askForTermsOfServiceAndPrivacyPolicy,
  askForWaiveOfWithdrawalRight
}