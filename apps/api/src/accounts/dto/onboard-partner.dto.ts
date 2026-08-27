import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsNumberString, IsOptional, IsString, Matches, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class InitialStockItemDto {
  @IsNumberString() warehouseId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class OnboardPartnerDto {
  @IsString() @MinLength(3) @MaxLength(100)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;

  @IsString() @MinLength(8) @MaxLength(200)
  password!: string;

  @IsOptional() @IsArray() @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => InitialStockItemDto)
  items: InitialStockItemDto[] = [];
}
