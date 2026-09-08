import { Module } from '@nestjs/common';
import { ContactRevealService } from './contact-reveal.service';

@Module({
  providers: [ContactRevealService],
  exports: [ContactRevealService],
})
export class ContactRevealModule {}
