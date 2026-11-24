import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // chamado de um Server Component: o middleware renova a sessão
          }
        },
      },
    },
  );
}

/** Todas as linhas de uma consulta, de 1.000 em 1.000 (o banco devolve no máximo 1.000 por vez).
 *  Para somas de dinheiro: nunca somar uma lista cortada. A consulta precisa de ordem fixa. */
export async function todasAsLinhas<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<{ data: T[]; error: unknown }> {
  const linhas: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await pagina(de, de + 999);
    if (error) throw new Error("Não foi possível ler tudo do banco agora. Tente de novo.");
    linhas.push(...(data ?? []));
    if (!data || data.length < 1000) return { data: linhas, error: null };
  }
}
