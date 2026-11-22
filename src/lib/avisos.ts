/** Chave pública VAPID dos avisos (a privada fica no cofre do Supabase) */
export const CHAVE_AVISOS = "BCk3hTr3dfdUqThN65-t1EvYIlywlbYipM8IchudHFXmPAwl0sASfAGedyKWv2ybc-fTO0vY9Cs_ptKdobIrlz4";

export function chaveEmBytes(base64url: string) {
  const b = atob((base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
