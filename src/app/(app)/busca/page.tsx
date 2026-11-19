import { Busca } from "@/components/Busca";

export const metadata = { title: "Buscar" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div className="page page--narrow">
      <div className="page__head">
        <div>
          <h1 className="page__t">Buscar</h1>
          <p className="page__sub">Títulos, notas, contextos, projetos, compromissos e pessoas.</p>
        </div>
      </div>
      <Busca inicial={q ?? ""} />
    </div>
  );
}
