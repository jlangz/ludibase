import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Response } from 'express'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      const raw =
        typeof body === 'string'
          ? body
          : ((body as { message?: unknown }).message ?? exception.message)
      const error = Array.isArray(raw) ? raw.join('; ') : String(raw)
      res.status(status).json({ error })
      return
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' })
  }
}
