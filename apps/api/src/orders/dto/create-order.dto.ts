import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsNumberString, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

export class CreateOrderItemDto {
  @IsNumberString() warehouseId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class CreateOrderDto {
  @IsOptional() @IsUUID() supplierId?: string;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
