import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ListingSlotsModule } from '../listing-slots/listing-slots.module';
import { ListingsModule } from '../listings/listings.module';

@Module({
  imports: [ListingSlotsModule, ListingsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
