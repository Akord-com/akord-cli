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
            filename: "logs/example.log",
        }),
        new transports.File({
            level: "error",
            filename: "logs/error.log",
        }),
        new transports.Console({
            level: "info"
        }),
    ],
});
