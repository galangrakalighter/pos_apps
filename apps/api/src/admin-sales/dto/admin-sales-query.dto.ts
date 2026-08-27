import { IsDateString, IsNumberString, IsOptional, IsUUID } from 'class-validator';

export class AdminSalesQueryDto {
  @IsOptional() @IsUUID() mitraId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsNumberString() productId?: string;
}
