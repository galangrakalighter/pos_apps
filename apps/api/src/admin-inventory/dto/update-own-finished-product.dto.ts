import { IsInt, IsNumberString, IsOptional, Min } from 'class-validator';

export class UpdateOwnFinishedProductDto {
  @IsInt() @Min(0) stock!: number;
  @IsOptional() @IsNumberString() price?: string;
}
