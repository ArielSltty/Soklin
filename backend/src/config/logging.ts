import winston from 'winston';
import path from 'path';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json({
    replacer: (key, value) => typeof value === 'bigint' ? value.toString() : value
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    if (stack) {
      log += `\n${stack}`;
    }

    if (Object.keys(meta).length > 0) {
      try {
        // Handle BigInt serialization
        const serializedMeta = JSON.stringify(meta, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value, 2
        );
        log += `\n${serializedMeta}`;
      } catch (error) {
        // Fallback if JSON.stringify fails
        log += `\n{ "error": "Failed to serialize log metadata", "originalError": "${error}" }`;
      }
    }

    return log;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'soklin-backend'
  },
  transports: [
    // File transports for production
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
} else {
  logger.add(new winston.transports.Console({
    format: logFormat
  }));
}

// Create a stream for Morgan (HTTP logging)
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Logger utility functions
export const log = {
  info: (message: string, meta?: any) => logger.info(message, meta),
  error: (message: string, error?: any) => {
    if (error instanceof Error) {
      logger.error(message, {
        error: error.message,
        stack: error.stack,
        // Don't spread the error object directly as it might contain BigInt values
        name: error.name
      });
    } else {
      logger.error(message, { error });
    }
  },
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  http: (message: string, meta?: any) => logger.info(message, meta)
};

export { logger };