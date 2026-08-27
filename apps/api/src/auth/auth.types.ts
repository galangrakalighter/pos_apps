export interface AuthenticatedUser {
  id: string;
  mitraId: string;
  username: string;
  partnerName: string;
  isPusat: boolean;
  centralSupplierId: string | null;
}

export interface AccessTokenPayload {
  sub: string;
  username: string;
  isPusat: boolean;
}
