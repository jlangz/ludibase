import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common'
import { databaseProviders } from './database.providers'
import { DB, PG_CLIENT } from './database.tokens'

type PgClient = { end: () => Promise<void> }

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  private readonly logger = new Logger('Database')
  constructor(@Inject(PG_CLIENT) private readonly client: PgClient) {}

  async onApplicationShutdown() {
    await this.client.end()
    this.logger.log('Database connection closed')
  }
}

@Global()
@Module({
  providers: [...databaseProviders, DatabaseLifecycle],
  exports: [DB, PG_CLIENT],
})
export class DatabaseModule {}
