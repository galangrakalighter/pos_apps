import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { SyncHistoryDto } from './dto/sync-history.dto';
import { HistorySyncService } from './history-sync.service';

@Controller('history')
@UseGuards(JwtAuthGuard)
export class HistorySyncController {
  constructor(private readonly service: HistorySyncService) {}

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.mine(user.mitraId);
  }

  @Post('sync')
  sync(@CurrentUser() user: AuthenticatedUser, @Body() body: SyncHistoryDto) {
    return this.service.sync(user.mitraId, body.items);
  }
}
