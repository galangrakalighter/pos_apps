import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SaveDiscountDto } from './discounts.dto';
import { DiscountsService } from './discounts.service';

@Controller('discounts')
@UseGuards(JwtAuthGuard)
export class DiscountsController {
  constructor(private readonly service: DiscountsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.service.list(user); }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveDiscountDto) { return this.service.create(user, dto); }
  @Patch(':id') update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: SaveDiscountDto) { return this.service.update(user, String(id), dto); }
  @Delete(':id') remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { return this.service.remove(user, String(id)); }
}
