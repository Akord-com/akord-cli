import os from 'os';
import ora from 'ora';
import { format, createLogger, transports } from "winston";
import makeRedact from 'redact-secrets'

const { combine, timestamp, prettyPrint } = format;
const LOGS_PATH = `${os.homedir()}/.akord/logs`
const redact = makeRedact('[REDACTED]')

export const logger = createLogger({
    level: "debug",
    format: combine(
        //format(info => redact.map(info))(),
        timestamp({
            format: "MMM-DD-YYYY HH:mm:ss",
        }),
        prettyPrint()
    ),
    transports: [
        new transports.File({
            filename: LOGS_PATH,
            maxsize: 5000000, 
            maxFiles: 10
        }),
        new transports.File({
            level: "error",
            filename: LOGS_PATH,
            maxsize: 5000000, 
            maxFiles: 10 
        }),
    ],
});

export let spinner: ora.Ora = ora()
export let isVerbose: boolean = true

export function muteSpinner () {
    spinner = ora({ isSilent: true })
    isVerbose = false
}
