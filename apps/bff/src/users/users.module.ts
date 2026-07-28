import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ListingSlotsModule } from '../listing-slots/listing-slots.module';

@Module({
  imports: [ListingSlotsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
