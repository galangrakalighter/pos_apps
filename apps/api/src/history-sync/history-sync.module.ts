import { Module } from '@nestjs/common';
import { HistorySyncController } from './history-sync.controller';
import { HistorySyncService } from './history-sync.service';
import { AuthModule } from '../auth/auth.module';

@Module({ imports: [AuthModule], controllers: [HistorySyncController], providers: [HistorySyncService] })
export class HistorySyncModule {}
