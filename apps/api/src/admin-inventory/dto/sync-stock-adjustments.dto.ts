import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsNumber, IsNumberString, IsUUID, ValidateNested } from 'class-validator';

export class StockAdjustmentItemDto {
  @IsUUID() uuid!: string;
  @IsNumberString() productId!: string;
  @IsNumber() delta!: number;
  @IsDateString() createdAt!: string;
}

export class SyncStockAdjustmentsDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => StockAdjustmentItemDto)
  items!: StockAdjustmentItemDto[];
}
