/** Aparece na hora ao trocar de tela, enquanto o servidor monta a próxima */
export default function Carregando() {
  return (
    <div className="page page--wide carregando" aria-busy="true" aria-label="Carregando">
      <i className="esq esq--titulo" />
      <i className="esq esq--palco" />
      <div className="esq__cols"><i className="esq esq--bloco" /><i className="esq esq--bloco" /></div>
    </div>
  );
}
