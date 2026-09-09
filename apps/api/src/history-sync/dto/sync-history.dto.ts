import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RawMaterialAddonDto {
  @IsNumberString() productId!: string;
  @IsString() @MaxLength(200) name!: string;
}

export class HistoryItemDto {
  @IsUUID() uuid!: string;
  @IsNumberString() productId!: string;
  @IsInt() @Min(1) soldQuantity!: number;
  @IsNumberString() price!: string;
  @IsDateString() createdAt!: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsOptional() @IsUUID() transactionUuid?: string;
  @IsOptional() @IsIn(['tunai', 'qris', 'transfer', 'debit']) paymentMethod?: string;
  @IsOptional() @IsNumberString() amountPaid?: string;
  @IsOptional() @IsNumberString() changeAmount?: string;
  @IsOptional() @IsNumberString() transactionTotal?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => RawMaterialAddonDto)
  rawMaterialAddons?: RawMaterialAddonDto[];
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
