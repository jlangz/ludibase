import 'reflect-metadata'
import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './http/common/filters/all-exceptions.filter'
import { APP_CONFIG } from './http/config/config.tokens'
import type { AppConfig } from './http/config/app-config.interface'

async function bootstrap() {
  const logger = new Logger('Bootstrap')
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  })

  const config = app.get<AppConfig>(APP_CONFIG)

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  )
  app.useGlobalFilters(new AllExceptionsFilter())

  app.enableCors({
    origin: (origin, callback) => {
      if (!config.corsOrigin) return callback(null, origin || true)
      if (!origin) return callback(null, true)
      const allowed = config.corsOrigin.split(',').map((o) => o.trim())
      for (const pattern of allowed) {
        if (origin === pattern) return callback(null, true)
        if (pattern.startsWith('*.') && origin.endsWith(pattern.slice(1))) {
          return callback(null, true)
        }
      }
      return callback(null, false)
    },
  })

  app.enableShutdownHooks()

  await app.listen(config.serverPort)
  logger.log(`Server listening on :${config.serverPort}`)
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Bootstrap failed:', err)
  process.exit(1)
})
