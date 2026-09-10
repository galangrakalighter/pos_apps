import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsNumberString, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class RecipeItemDto {
  @IsNumberString() ingredientId!: string;
  @IsNumber() @Min(0.001) quantity!: number;
  @IsIn(['gram', 'kilogram', 'mililiter', 'liter', 'pcs', 'pack', 'botol', 'kaleng']) unit!: string;
}

export class CreateWarehouseProductDto {
  @IsString() @MinLength(2) @MaxLength(150)
  name!: string;

  @IsString() @MinLength(2) @MaxLength(100)
  type!: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0)
  stock = 0;

  @IsNumberString()
  price!: string;

  @IsOptional() @IsIn(['bahan_baku', 'produk_jadi'])
  kind: 'bahan_baku' | 'produk_jadi' = 'bahan_baku';

  @IsOptional() @IsIn(['kilogram', 'liter', 'pcs'])
  unit = 'pcs';

  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => RecipeItemDto)
  recipes: RecipeItemDto[] = [];
}
