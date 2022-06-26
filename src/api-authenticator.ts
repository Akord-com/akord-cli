import 'cross-fetch/polyfill';
import * as AmazonCognitoIdentity from 'amazon-cognito-identity-js';
import { ClientConfig } from "./client-config";
import { awsConfig, AWSConfig } from "./aws-config";

export default class ApiAuthenticator {
  public config!: AWSConfig;

  constructor(config: ClientConfig) {
    this.config = awsConfig(config.env);
  }

  public getCognitoUser(username: string): AmazonCognitoIdentity.CognitoUser {
    const userPool = this.getCognitoUserPool();
    const userData = {
      Username: username,
      Pool: userPool
    };
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
    return cognitoUser;
  }

  public getCognitoUserPool(): AmazonCognitoIdentity.CognitoUserPool {
    const poolData = {
      UserPoolId: this.config.aws_user_pools_id,
      ClientId: this.config.aws_user_pools_web_client_id
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    return userPool;
  }

  public async getJWTToken(username: string, password: string): Promise<string> {
    const { session } = await this.authenticateUser(username, password);
    return session.getAccessToken().getJwtToken();
  }

  public async authenticateUser(username: string, password: string): Promise<{
    user: AmazonCognitoIdentity.CognitoUser,
    session: AmazonCognitoIdentity.CognitoUserSession
  }> {
    const cognitoUser = this.getCognitoUser(username);
    const authenticationData = {
      Username: username,
      Password: password,
    };
    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: function (result) {
          resolve({ user: cognitoUser, session: result })
        },
        onFailure: function (err) {
          console.log(err);
          return reject;
        }
      })
    }
    );
  }

  public async getUserAttributes(email: string, password: string): Promise<Object> {
    const { user } = await this.authenticateUser(email, password);
    return new Promise((resolve, reject) => {
      user.getUserAttributes(async function (err, result) {
        if (err) {
          console.log(err.message || JSON.stringify(err));
          reject();
        }
        const attributes = result.reduce(function (
          attributesObject,
          attribute
        ) {
          attributesObject[attribute.Name] = attribute.Value;
          return attributesObject;
        }, {});
        resolve(attributes);
      })
    }
    );
  }

  public async signup(email: string, password: string, customAttributes: any): Promise<Object> {
    let attributes = [];

    for (const [key, value] of Object.entries(customAttributes)) {
      attributes.push(new AmazonCognitoIdentity.CognitoUserAttribute({
        Name: key,
        Value: <string>value
      }));
    }

    const userPool = this.getCognitoUserPool();

    return new Promise((resolve, reject) =>
      userPool.signUp(email, password, attributes, null, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }, { clientType: "CLI" })
    );
  }

  public async resendCode(email: string): Promise<Object> {
    const user = this.getCognitoUser(email);
    return new Promise((resolve, reject) =>
      user.resendConfirmationCode((err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      })
    );
  }

  public async verifyAccount(email: string, code: string): Promise<Object> {
    const user = this.getCognitoUser(email);
    return new Promise((resolve, reject) =>
      user.confirmRegistration(code, false, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      })
    );
  }
}