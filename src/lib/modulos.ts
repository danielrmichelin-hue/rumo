// Os módulos do Rumo (docs/rumo-completo.md, Parte 5 e 6). O Core é de todos e não aparece aqui.
// Ligar um módulo muda a barra lateral e o que chega ao Hoje; o Core não muda.
// Módulo ligado que ainda não existe (disponivel: false) fica salvo no perfil e não aparece em lugar nenhum.

export type ChaveModulo = "negocios" | "estudos" | "rotinas" | "notas" | "rotas";

export type Modulo = {
  chave: ChaveModulo;
  nome: string;
  /** nome do grupo na barra lateral */
  grupo: string;
  disponivel: boolean;
};

export const MODULOS: Modulo[] = [
  { chave: "negocios", nome: "Negócios", grupo: "Negócios", disponivel: true },
  { chave: "estudos", nome: "Estudos", grupo: "Estudos", disponivel: false },
  { chave: "rotinas", nome: "Rotinas & Hábitos", grupo: "Rotinas", disponivel: false },
  { chave: "notas", nome: "Notas", grupo: "Notas", disponivel: false },
  { chave: "rotas", nome: "Rotas", grupo: "Rotas", disponivel: false },
];

export function moduloLigado(modulos: string[], chave: ChaveModulo) {
  return modulos.includes(chave) && MODULOS.some((m) => m.chave === chave && m.disponivel);
}

// ---------- perguntas do começo (docs/onboarding.md) ----------

export type ChaveEscolha = "trabalho" | "negocios" | "estudos" | "vida" | "rotinas" | "objetivos" | "projetos";

export type Escolha = {
  chave: ChaveEscolha;
  rotulo: string;
  /** módulo que a escolha liga; sem módulo, vira contextos e projetos do Core */
  modulo: ChaveModulo | null;
  pergunta: string;
  sugestoes: string[];
  /** o que a resposta cria */
  cria: "contexto-area" | "contexto-empresa" | "projeto" | "trabalho" | "nada";
};

/** Na ordem das perguntas do passo 3 */
export const ESCOLHAS: Escolha[] = [
  { chave: "trabalho", rotulo: "Trabalho", modulo: null, pergunta: "De onde chegam as suas demandas de trabalho?", sugestoes: ["E-mail", "WhatsApp", "Sistemas da empresa", "Reuniões"], cria: "trabalho" },
  { chave: "vida", rotulo: "Vida pessoal", modulo: null, pergunta: "Quais áreas da vida pessoal você quer organizar?", sugestoes: ["Casa", "Saúde", "Finanças", "Família"], cria: "contexto-area" },
  { chave: "projetos", rotulo: "Projetos pessoais", modulo: null, pergunta: "Algum projeto pessoal em andamento?", sugestoes: ["Reforma", "Viagem", "Mudança", "Casamento"], cria: "projeto" },
  { chave: "negocios", rotulo: "Meus negócios", modulo: "negocios", pergunta: "Quais empresas você quer acompanhar?", sugestoes: [], cria: "contexto-empresa" },
  { chave: "estudos", rotulo: "Estudos", modulo: "estudos", pergunta: "O que você estuda agora?", sugestoes: ["Graduação", "Pós", "Idiomas", "Concurso", "Curso livre"], cria: "nada" },
  { chave: "rotinas", rotulo: "Rotinas e hábitos", modulo: "rotinas", pergunta: "Alguma rotina que você já tenta manter?", sugestoes: ["Academia", "Leitura", "Meditação", "Revisar a semana"], cria: "nada" },
  { chave: "objetivos", rotulo: "Objetivos e metas", modulo: "rotas", pergunta: "Qual é o primeiro destino?", sugestoes: ["Guardar dinheiro", "Terminar um livro", "Concluir um curso", "Abrir um negócio"], cria: "nada" },
];

/** Ordem em que as opções aparecem no passo 2 (como na tela conceitual) */
export const ORDEM_OPCOES: ChaveEscolha[] = ["trabalho", "negocios", "estudos", "vida", "rotinas", "objetivos", "projetos"];
