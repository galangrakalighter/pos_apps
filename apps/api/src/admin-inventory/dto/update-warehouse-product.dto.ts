import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumberString, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { RecipeItemDto } from './create-warehouse-product.dto';

export class UpdateWarehouseProductDto {
  @IsString() @MinLength(2) @MaxLength(150)
  name!: string;

  @IsString() @MinLength(2) @MaxLength(100)
  type!: string;

  @IsInt() @Min(0)
  stock!: number;

  @IsNumberString()
  price!: string;

  @IsIn(['bahan_baku', 'produk_jadi'])
  kind!: 'bahan_baku' | 'produk_jadi';

  @IsIn(['gram', 'kilogram', 'mililiter', 'liter', 'pcs', 'pack', 'botol', 'kaleng'])
  unit!: string;

  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => RecipeItemDto)
  recipes: RecipeItemDto[] = [];
}
