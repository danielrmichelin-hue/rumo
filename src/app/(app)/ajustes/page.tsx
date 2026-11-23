import Link from "next/link";
import { ChevronRight, Download, LogOut, Shapes } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FormNome } from "@/components/FormNome";
import { SeletorTema } from "@/components/Tema";
import { Notificacoes } from "@/components/Notificacoes";
import { AgendaGoogle, AreasDaLateral, AtalhoSiri } from "@/components/AjustesExtras";
import { headers } from "next/headers";

export const metadata = { title: "Ajustes" };

export default async function Page() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: perfil }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("display_name, hidden_areas, capture_token, ical_url").maybeSingle(),
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

        <section className="card">
          <h2 className="card__t">Áreas na lateral</h2>
          <AreasDaLateral escondidas={perfil?.hidden_areas ?? []} />
        </section>

        <section className="card">
          <h2 className="card__t">Agenda do Google</h2>
          <AgendaGoogle url={perfil?.ical_url ?? null} />
        </section>

        <section className="card">
          <h2 className="card__t">Atalho da Siri</h2>
          <AtalhoSiri chave={perfil?.capture_token ?? null} site={`https://${(await headers()).get("host") ?? "rumo-iter-midia.vercel.app"}`} />
        </section>

        <section className="card">
          <h2 className="card__t">Notificações</h2>
          <Notificacoes />
        </section>

        <ul className="menu">
          <li><Link href="/contextos"><Shapes aria-hidden />Contextos<ChevronRight aria-hidden style={{ marginLeft: "auto" }} /></Link></li>
          <li><a href="/ajustes/copia" download><Download aria-hidden />Baixar cópia dos meus dados<em>Tudo num arquivo, para guardar</em><ChevronRight aria-hidden /></a></li>
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
