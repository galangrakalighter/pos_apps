import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SaveDiscountDto {
  @IsString() @MaxLength(150) name!: string;
  @IsIn(['percent', 'fixed']) type!: 'percent' | 'fixed';
  @IsNumber() @Min(0.01) value!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
