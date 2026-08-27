import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class HistoryItemDto {
  @IsUUID() uuid!: string;
  @IsNumberString() productId!: string;
  @IsInt() @Min(1) soldQuantity!: number;
  @IsNumberString() price!: string;
  @IsDateString() createdAt!: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class SyncHistoryDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => HistoryItemDto)
  items!: HistoryItemDto[];
}

export interface SyncHistoryResult {
  acknowledgedUuids: string[];
}
