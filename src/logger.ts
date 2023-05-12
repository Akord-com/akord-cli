import { format, createLogger, transports } from "winston";
import { CONFIG_STORE_PATH } from "./handlers";
const { combine, timestamp, prettyPrint } = format;
const LOGS_PATH = `${CONFIG_STORE_PATH}/logs`

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
