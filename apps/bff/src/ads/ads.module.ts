import { Module } from '@nestjs/common';
import { GoogleAdsConversionProvider } from './google-ads-conversion.provider';

@Module({
  providers: [GoogleAdsConversionProvider],
  exports: [GoogleAdsConversionProvider],
})
export class AdsModule {}
