import { Injectable, Logger } from '@nestjs/common'

/**
 * Tracks fire-and-forget background promises so callers can return a 202-like
 * response immediately while work continues. Errors are logged centrally.
 *
 * Intentionally in-memory — for once-a-day jobs with cron coverage, durable
 * queues like BullMQ would be overkill. Revisit if multiple long-running
 * jobs need to coexist or survive restarts.
 */
@Injectable()
export class BackgroundTasks {
  private readonly logger = new Logger('BackgroundTasks')
  private readonly running = new Map<string, Promise<unknown>>()

  run<T>(name: string, fn: () => Promise<T>): void {
    const existing = this.running.get(name)
    if (existing) {
      this.logger.warn(`[${name}] already running, ignoring duplicate trigger`)
      return
    }
    this.logger.log(`[${name}] started`)
    const p = fn()
      .then((result) => {
        this.logger.log(`[${name}] completed`)
        return result
      })
      .catch((err) => {
        this.logger.error(`[${name}] failed: ${err instanceof Error ? err.message : err}`)
      })
      .finally(() => {
        this.running.delete(name)
      })
    this.running.set(name, p)
  }

  isRunning(name: string): boolean {
    return this.running.has(name)
  }

  runningTasks(): string[] {
    return [...this.running.keys()]
  }
}
