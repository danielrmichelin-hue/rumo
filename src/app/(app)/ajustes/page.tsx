import Link from "next/link";
import { ChevronRight, LogOut, Shapes, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FormNome } from "@/components/FormNome";
import { SeletorTema } from "@/components/Tema";

export const metadata = { title: "Ajustes" };

export default async function Page() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: perfil }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("display_name").maybeSingle(),
  ]);

  return (
    <div className="page page--narrow">
      <div className="page__head">
        <div>
          <h1 className="page__t">Ajustes</h1>
          <p className="page__sub">{user?.email}</p>
        </div>
      </div>

      <div className="settings">
        <section className="card">
          <h2 className="card__t">Como você quer ser chamado</h2>
          <FormNome nome={perfil?.display_name ?? ""} />
        </section>

        <section className="card">
          <h2 className="card__t">Tema</h2>
          <SeletorTema />
          <p className="field__hint" style={{ marginTop: 10 }}>Automático segue o claro ou escuro do aparelho.</p>
        </section>

        <ul className="menu">
          <li><Link href="/comecar"><Sparkles aria-hidden />O que você organiza<em>Refazer as perguntas do começo</em><ChevronRight aria-hidden /></Link></li>
          <li><Link href="/contextos"><Shapes aria-hidden />Contextos<ChevronRight aria-hidden style={{ marginLeft: "auto" }} /></Link></li>
          <li>
            <form action="/auth/sair" method="post">
              <button type="submit"><LogOut aria-hidden />Sair</button>
            </form>
          </li>
        </ul>
      </div>
    </div>
  );
}
