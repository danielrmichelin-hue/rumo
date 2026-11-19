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
  { chave: "estudos", nome: "Estudos", grupo: "Estudos", disponivel: true },
  { chave: "rotinas", nome: "Rotinas & Hábitos", grupo: "Rotinas", disponivel: true },
  { chave: "notas", nome: "Notas", grupo: "Notas", disponivel: true },
  { chave: "rotas", nome: "Rotas", grupo: "Rotas", disponivel: true },
];

export function moduloLigado(modulos: string[], chave: ChaveModulo) {
  return modulos.includes(chave) && MODULOS.some((m) => m.chave === chave && m.disponivel);
}

// ---------- perguntas do começo (docs/onboarding.md) ----------

export type ChaveEscolha = "trabalho" | "negocios" | "estudos" | "vida" | "rotinas" | "objetivos" | "projetos";

export type Escolha = {
  chave: ChaveEscolha;
  rotulo: string;
  /** uma linha que diz para quem é a opção */
  dica: string;
  /** módulo que a escolha liga; sem módulo, vira contextos e projetos do Core */
  modulo: ChaveModulo | null;
  pergunta: string;
  sugestoes: string[];
  /** o que a resposta cria */
  cria: "contexto-area" | "contexto-empresa" | "projeto" | "trabalho" | "nada";
};

/** Na ordem das perguntas do passo 3 */
export const ESCOLHAS: Escolha[] = [
  { chave: "trabalho", dica: "Você trabalha para alguém. É dono? Escolha Meus negócios.", rotulo: "Trabalho", modulo: null, pergunta: "De onde chegam as suas demandas de trabalho?", sugestoes: ["E-mail", "WhatsApp", "Sistemas da empresa", "Reuniões"], cria: "trabalho" },
  { chave: "vida", dica: "Casa, saúde, finanças, família.", rotulo: "Vida pessoal", modulo: null, pergunta: "Quais áreas da vida pessoal você quer organizar?", sugestoes: ["Casa", "Saúde", "Finanças", "Família"], cria: "contexto-area" },
  { chave: "projetos", dica: "Reforma, viagem, mudança.", rotulo: "Projetos pessoais", modulo: null, pergunta: "Algum projeto pessoal em andamento?", sugestoes: ["Reforma", "Viagem", "Mudança", "Casamento"], cria: "projeto" },
  { chave: "negocios", dica: "Empresas que você tem ou dirige: só a sua parte.", rotulo: "Meus negócios", modulo: "negocios", pergunta: "Quais empresas você quer acompanhar?", sugestoes: [], cria: "contexto-empresa" },
  { chave: "estudos", dica: "Faculdade, pós, concurso, idioma.", rotulo: "Estudos", modulo: "estudos", pergunta: "O que você estuda agora?", sugestoes: ["Graduação", "Pós", "Idiomas", "Concurso", "Curso livre"], cria: "nada" },
  { chave: "rotinas", dica: "Academia, leitura, contas do mês.", rotulo: "Rotinas e hábitos", modulo: "rotinas", pergunta: "Alguma rotina que você já tenta manter?", sugestoes: ["Academia", "Leitura", "Meditação", "Revisar a semana"], cria: "nada" },
  { chave: "objetivos", dica: "Guardar dinheiro, terminar um curso.", rotulo: "Objetivos e metas", modulo: "rotas", pergunta: "Qual é o primeiro destino?", sugestoes: ["Guardar dinheiro", "Terminar um livro", "Concluir um curso", "Abrir um negócio"], cria: "nada" },
];

/** Ordem em que as opções aparecem no passo 2: vida pessoal primeiro (público inicial, docs/publico.md) */
export const ORDEM_OPCOES: ChaveEscolha[] = ["vida", "estudos", "rotinas", "objetivos", "projetos", "trabalho", "negocios"];
