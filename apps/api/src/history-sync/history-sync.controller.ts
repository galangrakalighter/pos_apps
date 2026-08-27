import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { SyncHistoryDto } from './dto/sync-history.dto';
import { HistorySyncService } from './history-sync.service';

@Controller('history')
@UseGuards(JwtAuthGuard)
export class HistorySyncController {
  constructor(private readonly service: HistorySyncService) {}

  @Post('sync')
  sync(@CurrentUser() user: AuthenticatedUser, @Body() body: SyncHistoryDto) {
    return this.service.sync(user.mitraId, body.items);
  }
}
