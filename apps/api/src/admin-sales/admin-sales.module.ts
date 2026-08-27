import { Module } from '@nestjs/common';
import { AdminSalesController } from './admin-sales.controller';
import { AdminSalesService } from './admin-sales.service';
import { AuthModule } from '../auth/auth.module';

@Module({ imports: [AuthModule], controllers: [AdminSalesController], providers: [AdminSalesService] })
export class AdminSalesModule {}
