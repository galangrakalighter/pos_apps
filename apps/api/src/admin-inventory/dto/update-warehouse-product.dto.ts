import { IsInt, IsNumberString, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateWarehouseProductDto {
  @IsString() @MinLength(2) @MaxLength(150)
  name!: string;

  @IsString() @MinLength(2) @MaxLength(100)
  type!: string;

  @IsInt() @Min(0)
  stock!: number;

  @IsNumberString()
  price!: string;
}
