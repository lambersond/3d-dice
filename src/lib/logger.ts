const isDev = process.env.NODE_ENV !== 'production'

export const logger = {
  /** Informational — dev only, silent in production */
  info: (message: string, ...args: unknown[]) => {
    if (isDev) console.warn(`[info] ${message}`, ...args)
  },
  /** Unexpected but recoverable — always logged */
  warn: (message: string, ...args: unknown[]) => {
    console.warn(message, ...args)
  },
  /** Failures that need attention — always logged */
  error: (message: string, ...args: unknown[]) => {
    console.error(message, ...args)
  },
}
