import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreatePartnerAccountDto {
  @IsString() @MinLength(3) @MaxLength(100)
  @Matches(/^[a-zA-Z0-9._-]+$/, { message: 'username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip' })
  username!: string;

  @IsString() @MinLength(8) @MaxLength(200)
  password!: string;
}
