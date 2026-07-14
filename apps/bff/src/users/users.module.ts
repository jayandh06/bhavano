import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { ListingsModule } from '../listings/listings.module';

@Module({
  imports: [ListingsModule],
  controllers: [UsersController],
})
export class UsersModule {}
