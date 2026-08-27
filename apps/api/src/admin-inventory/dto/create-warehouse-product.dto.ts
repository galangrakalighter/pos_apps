import { IsInt, IsNumberString, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateWarehouseProductDto {
  @IsString() @MinLength(2) @MaxLength(150)
  name!: string;

  @IsString() @MinLength(2) @MaxLength(100)
  type!: string;

  @IsOptional() @IsInt() @Min(0)
  stock = 0;

  @IsNumberString()
  price!: string;
}
