/** GET /v1/auth/me (backend app/identity/auth/schemas.py MeResponse): the fields used here. */
export interface MeResponse {
  user: { id: number; name: string | null; email: string; role: string };
  pharmacy: { id: number; name: string; code: string | null } | null;
  permissions: string[];
}
