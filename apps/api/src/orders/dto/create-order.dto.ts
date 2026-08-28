import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsNumberString, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

export class CreateOrderItemDto {
  @IsNumberString() warehouseId!: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) quantity!: number;
  @IsIn(['gram', 'kilogram', 'mililiter', 'liter', 'pcs', 'pack', 'botol', 'kaleng']) unit!: string;
}

export class CreateOrderDto {
  @IsOptional() @IsUUID() supplierId?: string;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
