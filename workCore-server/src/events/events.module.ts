import { Global, Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { UserModule } from '../user/user.module';

@Global()
@Module({
  imports: [UserModule], // дає REDIS_CLIENT для перевірки сесій сокетів
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
