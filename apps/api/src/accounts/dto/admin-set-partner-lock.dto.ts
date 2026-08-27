import { IsBoolean } from 'class-validator';

export class AdminSetPartnerLockDto {
  @IsBoolean()
  locked!: boolean;
}
