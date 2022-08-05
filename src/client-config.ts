import { WalletType } from "@akord/crypto"

export interface ClientConfig {
  env?: EnvType,
  network?: NetworkType,
  wallet?: WalletType,
  ledgerVersion?: LedgerVersion
}

export enum EnvType {
  PROD = "prod",
  DEV = "dev"
}

export enum NetworkType {
  LOCAL = "local",
  TESTNET = "testnet",
  MAINNET = "mainnet"
}

export enum LedgerVersion {
  V1 = "v1",
  V2 = "v2"
}