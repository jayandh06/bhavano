import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { OwnerRequirementMatchDto, RequirementDto } from '@bhavano/types';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { RequirementsService } from './requirements.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { UpdateMyRequirementDto } from './dto/update-my-requirement.dto';

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

  @Patch('mine/:id')
  updateMine(
    @Param('id') id: string,
    @Body() dto: UpdateMyRequirementDto,
    @CurrentUser() user: RequestUser,
  ): Promise<RequirementDto> {
    return this.requirementsService.updateMine(user.id, id, dto);
  }

  @Post('mine/:id/renew')
  @HttpCode(200)
  renewMine(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<RequirementDto> {
    return this.requirementsService.renewMine(user.id, id);
  }

  /** `fulfilled` and `withdrawn` are separate paths rather than one "close" with a body, because
   * which of the two happened is the only measure of whether this feature works. */
  @Post('mine/:id/fulfilled')
  @HttpCode(200)
  markFulfilled(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<RequirementDto> {
    return this.requirementsService.closeMine(user.id, id, 'fulfilled');
  }

  @Post('mine/:id/withdraw')
  @HttpCode(200)
  withdraw(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<RequirementDto> {
    return this.requirementsService.closeMine(user.id, id, 'withdrawn');
  }

  /** Demand matching the caller's own listings — what the owner match email links to. Returns an
   * empty list for someone with no inventory, which is the correct answer rather than an error:
   * they simply have nothing to match against yet. */
  @Get('matching')
  listMatching(@CurrentUser() user: RequestUser): Promise<OwnerRequirementMatchDto[]> {
    return this.requirementsService.listMatchingOwnerInventory(user.id);
  }
}
