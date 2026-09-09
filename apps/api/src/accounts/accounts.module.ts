import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountsController, ProfileImagesController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({ imports: [AuthModule], controllers: [AccountsController, ProfileImagesController], providers: [AccountsService] })
export class AccountsModule {}
