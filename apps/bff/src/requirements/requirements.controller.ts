import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { RequirementDto } from '@bhavano/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { RequirementsService } from './requirements.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';

@Controller('requirements')
@UseGuards(AuthGuard)
export class RequirementsController {
  constructor(private readonly requirementsService: RequirementsService) {}

  /** Login-gated deliberately: the OTP flow already proves a phone, which is the entire value of
   * the lead, and it makes the requirement something the seeker can come back to. Throttled below
   * the app default too — this is one deliberate action per dead-end search, not a stream, and a
   * tight limit is the cheapest guard against someone filling the table from one account. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateRequirementDto, @CurrentUser() user: RequestUser): Promise<RequirementDto> {
    return this.requirementsService.create(user.id, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() user: RequestUser): Promise<RequirementDto[]> {
    return this.requirementsService.listMine(user.id);
  }
}
