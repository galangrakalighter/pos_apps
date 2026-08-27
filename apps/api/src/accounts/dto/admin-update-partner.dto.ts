import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AdminUpdatePartnerDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(100)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username?: string;

  @IsOptional() @IsString() @MinLength(8) @MaxLength(200)
  password?: string;
}
