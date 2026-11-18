export const metadata = { title: "Projetos" };

export default function Page() {
  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__t">Projetos</h1>
          <p className="page__sub">Resultados com etapas e fim, com o próximo passo de cada um.</p>
        </div>
      </div>
      <div className="empty empty--box">
        <b>Em construção.</b>
        <span>Chega na fase 3.</span>
      </div>
    </div>
  );
}
