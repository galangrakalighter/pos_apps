import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminSalesService } from './admin-sales.service';
import { AdminSalesQueryDto } from './dto/admin-sales-query.dto';

@Controller('admin/sales')
@UseGuards(JwtAuthGuard)
export class AdminSalesController {
  constructor(private readonly service: AdminSalesService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser, @Query() query: AdminSalesQueryDto) {
    return this.service.summary(user.id, query);
  }
}
