import { IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateOwnProfileDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(100)
  @Matches(/^[a-zA-Z0-9._-]+$/, { message: 'username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip' })
  username?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(150)
  partnerName?: string;

  @IsOptional() @IsString() @MaxLength(100)
  region?: string;

  @ValidateIf((dto: UpdateOwnProfileDto) => Boolean(dto.newPassword))
  @IsString() @MinLength(1) @MaxLength(200)
  currentPassword?: string;

  @IsOptional() @IsString() @MinLength(8) @MaxLength(200)
  newPassword?: string;
}
