import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { BoostRotationService } from './boost-rotation.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, BoostRotationService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
