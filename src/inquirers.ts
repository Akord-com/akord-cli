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

const askForConfirmation = async (): Promise<{ confirmation: boolean }> => {
  return inquirer.prompt([
    {
      name: 'confirmation',
      type: 'confirm',
      message: `Are you sure you want to apply the changes?`
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
  askForConfirmation,
  askForFilePath,
  askForRole,
  askForPassword,
  askForCode,
  askForTermsOfServiceAndPrivacyPolicy,
  askForWaiveOfWithdrawalRight
}