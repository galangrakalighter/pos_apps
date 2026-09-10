import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsNumber, IsNumberString, IsOptional, IsString, Matches, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class InitialStockItemDto {
  @IsNumberString() warehouseId!: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) quantity!: number;
  @IsIn(['gram', 'kilogram', 'mililiter', 'liter', 'pcs', 'pack', 'botol', 'kaleng']) unit!: string;
}

export class OnboardPartnerDto {
  @IsString() @MinLength(3) @MaxLength(100)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;

  @IsString() @MinLength(2) @MaxLength(150)
  partnerName!: string;

  @IsEmail() @MaxLength(254)
  email!: string;

  @IsString() @MinLength(2) @MaxLength(100)
  region!: string;

  @IsString() @MinLength(8) @MaxLength(200)
  password!: string;

  @IsOptional() @IsArray() @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => InitialStockItemDto)
  items: InitialStockItemDto[] = [];
}
