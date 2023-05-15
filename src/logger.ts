import os from 'os';
import ora from 'ora';
import { format, createLogger, transports } from "winston";
const { combine, timestamp, prettyPrint } = format;
const LOGS_PATH = `${os.homedir()}/.akord/logs`


export const logger = createLogger({
    level: "debug",
    format: combine(
        timestamp({
            format: "MMM-DD-YYYY HH:mm:ss",
        }),
        prettyPrint()
    ),
    transports: [
        new transports.File({
            filename: LOGS_PATH,
        }),
        new transports.File({
            level: "error",
            filename: LOGS_PATH,
        }),
    ],
});

export let spinner: ora.Ora = ora()
export let isVerbose: boolean = true

export function muteSpinner () {
    spinner = ora({ isSilent: true })
    isVerbose = false
}
