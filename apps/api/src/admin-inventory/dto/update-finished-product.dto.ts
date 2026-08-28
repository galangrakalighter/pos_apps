import { IsInt, Min } from 'class-validator';

export class UpdateFinishedProductDto {
  @IsInt() @Min(0) stock!: number;
}
