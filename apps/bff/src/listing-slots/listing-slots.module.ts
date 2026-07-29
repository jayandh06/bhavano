import { Module } from '@nestjs/common';
import { ListingSlotsService } from './listing-slots.service';

@Module({
  providers: [ListingSlotsService],
  exports: [ListingSlotsService],
})
export class ListingSlotsModule {}
