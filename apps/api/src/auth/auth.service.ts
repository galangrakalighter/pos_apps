import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { DataSource } from 'typeorm';
import { AccessTokenPayload, AuthenticatedUser } from './auth.types';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly dataSource: DataSource, private readonly jwt: JwtService) {}

  async login(dto: LoginDto): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const rows: Array<{ id: string; username: string; password: string; partnerName: string; isPusat: boolean; isLocked: boolean }> =
      await this.dataSource.query(
        `SELECT id::text, username, password, nama_mitra AS "partnerName", "isPusat" AS "isPusat", is_locked AS "isLocked"
           FROM users WHERE username = $1 LIMIT 1`,
        [dto.username],
      );
    const row = rows[0];
    if (!row) throw new UnauthorizedException('Username atau password salah');
    if (row.isLocked) throw new UnauthorizedException('Akun Mitra sedang dikunci oleh pusat');

    const isHash = row.password.startsWith('$2');
    const valid = isHash ? await compare(dto.password, row.password) : dto.password === row.password;
    if (!valid) throw new UnauthorizedException('Username atau password salah');
    // Transparently upgrade legacy plaintext passwords on their first valid login.
    if (!isHash) {
      await this.dataSource.query('UPDATE users SET password = $1 WHERE id = $2::uuid', [await hash(dto.password, 12), row.id]);
    }

    const central: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id::text FROM users WHERE "isPusat" = TRUE ORDER BY created_at LIMIT 1`,
    );
    const user: AuthenticatedUser = { id: row.id, mitraId: row.id, username: row.username, partnerName: row.partnerName, isPusat: row.isPusat, centralSupplierId: central[0]?.id ?? null };
    const payload: AccessTokenPayload = { sub: user.id, username: user.username, isPusat: user.isPusat };
    // Intentionally no expiresIn: session ends only through explicit local logout.
    return { accessToken: await this.jwt.signAsync(payload), user };
  }
}
