import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SearchInterpretService, type SearchInterpretResponse } from './search-interpret.service';

export class InterpretSearchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  text!: string;

  /** The city the visitor is browsing, if any — a hint, never trusted. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  cityName?: string;
}

@Controller('search')
export class SearchInterpretController {
  constructor(private readonly service: SearchInterpretService) {}

  // Public (searching needs no login), so the abuse control is the per-IP throttle — web forwards the
  // visitor's IP, see docs/plans/safely-reactivate-bff-throttling.md — plus the service's cache and
  // daily cap. Not bound globally, only here, per that doc.
  @Post('interpret')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  interpret(@Body() dto: InterpretSearchDto): Promise<SearchInterpretResponse> {
    return this.service.interpret(dto.text, dto.cityName);
  }
}
