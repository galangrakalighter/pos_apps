import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { PartnerSyncService } from './partner-sync.service';

@Controller('sync-requests')
@UseGuards(JwtAuthGuard)
export class PartnerSyncController {
  constructor(private readonly service: PartnerSyncService) {}
  @Post('partners/:mitraId') request(@CurrentUser() user: AuthenticatedUser, @Param('mitraId', ParseUUIDPipe) mitraId: string) { return this.service.request(user, mitraId); }
  @Get(':id') status(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) { return this.service.status(user, id); }
  @Post('claim') claim(@CurrentUser() user: AuthenticatedUser) { return this.service.claim(user); }
  @Patch(':id/finish') finish(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: { success: boolean; error?: string }) { return this.service.finish(user, id, body.success === true, body.error); }
}
