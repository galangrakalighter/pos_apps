import { IsNumberString } from 'class-validator';
export class UpdatePartnerProductPriceDto { @IsNumberString() price!: string; }
