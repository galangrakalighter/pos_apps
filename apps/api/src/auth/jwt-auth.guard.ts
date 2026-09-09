import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AccessTokenPayload, AuthenticatedUser } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: AuthenticatedUser }>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Bearer token required');
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      const rows: Array<{ id: string; username: string; partnerName: string; isPusat: boolean; isLocked: boolean; profileImageUrl: string | null }> =
        await this.dataSource.query(
          `SELECT id::text, username, nama_mitra AS "partnerName", "isPusat" AS "isPusat", is_locked AS "isLocked", profile_image_url AS "profileImageUrl"
             FROM users WHERE id = $1::uuid`,
          [payload.sub],
        );
      const user = rows[0];
      if (!user) throw new UnauthorizedException('User no longer exists');
      if (user.isLocked) throw new UnauthorizedException('Akun Mitra sedang dikunci oleh pusat');
      const central: Array<{ id: string }> = await this.dataSource.query(
        `SELECT id::text FROM users WHERE "isPusat" = TRUE ORDER BY created_at LIMIT 1`,
      );
      request.user = { ...user, mitraId: user.id, centralSupplierId: central[0]?.id ?? null };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
