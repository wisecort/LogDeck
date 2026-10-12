import type { Level } from '../types'

/** Level words used by Apache error logs and nginx error logs. */
export const SYSLOG_LEVELS: Readonly<Record<string, Level>> = {
  debug: 'DEBUG',
  info: 'INFO',
  notice: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  crit: 'FATAL',
  alert: 'FATAL',
  emerg: 'FATAL',
}

/** Free-form level names (JSON loggers). */
export function levelFromName(name: string): Level | undefined {
  switch (name.toLowerCase()) {
    case 'trace':
      return 'TRACE'
    case 'debug':
    case 'dbug':
      return 'DEBUG'
    case 'info':
    case 'information':
    case 'notice':
      return 'INFO'
    case 'warn':
    case 'warning':
      return 'WARN'
    case 'error':
    case 'err':
      return 'ERROR'
    case 'fatal':
    case 'panic':
    case 'dpanic':
    case 'critical':
    case 'crit':
    case 'alert':
    case 'emergency':
    case 'emerg':
      return 'FATAL'
    default:
      return undefined
  }
}
