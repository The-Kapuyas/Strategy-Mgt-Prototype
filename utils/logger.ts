import { ENABLE_DEBUG_LOGS } from '../constants';

/**
 * Conditional logger that only logs in development mode
 */
class Logger {
  private enabled: boolean;

  constructor(enabled: boolean = ENABLE_DEBUG_LOGS) {
    this.enabled = enabled;
  }

  log(...args: any[]): void {
    if (this.enabled) {
      console.log(...args);
    }
  }

  warn(...args: any[]): void {
    console.warn(...args);
  }

  error(...args: any[]): void {
    console.error(...args);
  }

  info(...args: any[]): void {
    if (this.enabled) {
      console.info(...args);
    }
  }
}

export const logger = new Logger();

