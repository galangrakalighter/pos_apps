import { IsNumberString } from 'class-validator';

export class CreateFinishedProductDto {
  @IsNumberString() warehouseId!: string;
}
