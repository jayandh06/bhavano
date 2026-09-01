import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/auth.guard';
import { PushService } from './push.service';
import { DeletePushTokenDto, PushTokenDto } from './dto/push-token.dto';

@Controller('users/me/push-tokens')
@UseGuards(AuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  /** Idempotent — the app calls this on every login and on cold start while logged in. */
  @Post()
  @HttpCode(204)
  async register(
    @Body() dto: PushTokenDto,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    await this.push.registerToken(user.id, dto.token, dto.platform);
  }

  /** Called on logout. Takes the token in the body rather than keying on the user so a device
   * that has already switched accounts still clears the right row. */
  @Delete()
  @HttpCode(204)
  async unregister(@Body() dto: DeletePushTokenDto): Promise<void> {
    await this.push.removeToken(dto.token);
  }
}
