import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { ListingsModule } from '../listings/listings.module';

@Module({
  imports: [ListingsModule],
  controllers: [AgentsController],
  providers: [AgentsService],
})
export class AgentsModule {}
