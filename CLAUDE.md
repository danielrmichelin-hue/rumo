# Rumo · contexto para o Claude Code

O Rumo é o **software pessoal de gestão da vida do Daniel**: tarefas, empresas (Iter Mídia, Iter Contábil, Quintal
Escola…), estudos para a prova, finanças, saúde, rotinas e metas. **Não é um produto**: não há outros usuários,
cadastro, onboarding nem marketing. Decisão do Daniel (21/11/2026): continuar construindo só para o uso dele,
mantendo o nome e a interface atuais; o Brand Book deixa de ser regra.
Toda a comunicação, a interface e os textos são em **português do Brasil**.

## Como decidir o que construir

- A pergunta é uma só: **isso ajuda o Daniel no dia a dia dele?** Não importa se serviria para outras pessoas.
- Funcionalidade nova só quando ele pedir ou quando algo atrapalhar o uso. Na dúvida, pergunte a ele.
- Sem textos explicativos ("pra que serve"), sem telas de boas-vindas, sem listas vazias com parágrafo: frases curtas.
- Os documentos em `docs/` (Book, `rumo-completo.md`, `mvp.md`, `onboarding.md`) são histórico do tempo em que o Rumo
  era pensado como produto. Consulte se ajudar, mas não são obrigação.

## Regras que valem

- Finanças: **os lançamentos são a base de tudo**. Saída, entrada, investir (`aporte`) e resgatar (`resgate`) são
  lançamentos; o saldo da conta, o saldo de cada investimento, os envelopes e o resumo saem deles (`naConta`,
  `movimentosDe` em `src/lib/financas.ts`). Investir e resgatar são transferências: não contam como gasto nem renda.

- Tarefa (no banco: `responsibilities`) tem 3 estados: `a_fazer`, `aguardando`, `concluida`. "Atrasada" é exibição
  quando o prazo passou, e é **direta**: vermelho, "Atrasada há N dias", no topo do Hoje.
- `aguardando` exige quem e `follow_up_on` (padrão: 3 dias úteis); no dia, volta para o Hoje em Atenção.
- Sem contexto, sem projeto e sem Rota = Inbox. Com data = aparece no Hoje no dia.
- A captura entende: hoje, amanhã, dias da semana, datas (12/11), horas (10h, 14:30) e `#contexto`. O texto
  original fica em `raw_capture`.
- Ordem do Hoje: próximo passo; Atenção (atrasadas + cobranças); Hoje; Agenda; Rotinas e remédios; Para pagar;
  Estudos; Rotas; Aguardando alguém.
- Decisões são tarefas com `kind = 'decidir'`; a decisão fica na nota ao concluir.

## Interface

- Visual (22/11/2026): Inter (`public/fonts`, com `cv11`/`ss01`), Deep `#2B1E4B` e Purple `#6C4ED9`; lateral flutuante
  com brilho, botões e abas em pílula, rótulos de seção em caixa alta, superfícies com `--ring` (borda fina + sombra),
  e o "palco" (`--stage`, Deep com brilho) no topo do Hoje (`.palco`: saudação, linha do dia 6h–24h, números, próximo
  passo em vidro) e de Finanças (`.fin-onde`). Campos preenchidos (`--fill`), caixa de seleção própria, chip escolhido em
  `--inverse`, listas soltas viram cartão (`.list`; dentro de `.bloco`/`.card` não), menus com ícone em bloco, topo do celular em vidro. Tokens e tema claro/escuro em `src/app/globals.css` (o tema vem de
  `data-theme`; Claro, Escuro ou Auto em `src/lib/tema.ts`).
- Logo: os SVGs em `public/brand`; não redesenhar.
- Pode usar vermelho, contadores, mais de um destaque por tela: o que for mais claro para o Daniel.

## Tecnologia

- Next.js 15 (App Router, `src/`), TypeScript, CSS próprio (sem Tailwind), ícones `lucide-react`.
- Login: só entrada com e-mail e senha (`src/app/login/page.tsx`); não há cadastro nem perguntas do começo.
- Supabase via `@supabase/ssr`: `src/lib/supabase/{client,server,middleware}.ts`; `src/middleware.ts`
  protege as rotas (públicas: `/login`, `/auth`).
- Banco: projeto Supabase `rumo` (região São Paulo). `supabase/migrations/0001_core.sql` (contexts, people, projects,
  responsibilities, events, todas com `user_id` e RLS "dono lê/cria/altera/apaga"); 0002 (pg_trgm no schema
  `extensions`, search_path fixo no gatilho), 0003 (índices das chaves estrangeiras) e 0004 (`profiles`: nome,
  módulos e respostas do começo) 0005 (Rotas: `routes`, `route_milestones`, `route_entries`, e `route_id`/`milestone_id`
  em responsibilities) e 0006 (Estudos: `study_courses`, `study_subjects`; `course_id`, `subject_id` e `done_at` em events;
  `course_id` em routes) e 0007 (Rotinas: `routines`, com dias fixos ou N vezes por semana, e `routine_checks`, um registro
  por dia feito) e 0008 (Notas: `notes`, nota ou decisão com porquê e data, ligada a contexto, projeto ou curso) e 0009 (ciclo de estudos: `cycle_minutes` nas matérias, `study_topics` com os temas,
  `topic_id` nas sessões) e 0010 (rotinas mensais: `month_day`, uma frequência por rotina) e 0011 (estudos: `study_modules` opcionais, revisões
  `review_step`/`next_review_on` nas aulas) e 0012 (Finanças: `fin_entries`, `fin_budgets`; `amount` e `category` nas rotinas = conta
  fixa) e 0013 (Saúde: `dose` e `ends_on` nas rotinas = remédio com fim; `health_kind` nos events = consulta, exame, vacina,
  procedimento; `health_measures` com peso, pressão etc.) e 0014 (Finanças completas: `fin_settings` com dia do pagamento, envelopes
  e saldo da conta; `fin_installments` parcelamentos; `installment_id` nos lançamentos; `fin_investments` e `fin_inv_moves`) e 0015 (`subtasks`: checklist dentro da tarefa) e 0016 (lançamentos são a base: `investment_id` nos lançamentos; investir = saída com
  investimento, resgatar = entrada com investimento, e o app lê como `aporte`/`resgate` em `normalizarLancamento`; de
  `fin_inv_moves` o app lê só os rendimentos) e 0017 (avisos: `push_subscriptions`, `push_sent`, `rumo_segredo` lendo o cofre,
  pg_cron `rumo-avisos` a cada 5 min chamando a função `avisos`) e 0018 (`study_questions`: exercícios com acertos por matéria/tema;
  `study_mocks`: provas e notas) e 0019 (notas decimais em `study_mocks`) já aplicadas. Mudanças de banco = **nova migração numerada**, nunca editar
  a anterior depois de aplicada.
- Rotas do app em `src/app/(app)/…`. A casca (`src/components/Shell.tsx`) tem a lateral fixa: Hoje, Inbox, Calendário,
  Tarefas, Projetos; Áreas da vida (Negócios, Estudos, Finanças, Saúde, Rotinas, Rotas, Notas); Contextos (só os de tipo
  área; empresas ficam em Negócios). A tela Semana (`/semana`, `src/components/PlanoSemana.tsx`) planeja os 7 dias: arrastar a tarefa para um dia
  (ou o menu ⋮), carga do dia (tarefas e horas de agenda), atrasadas e sem data no topo. O Hoje é montado por `src/lib/hoje.ts`;
  semana do calendário em `src/lib/semana.ts`; resumo de projeto (progresso, entrega, próximo passo) em
  `src/lib/projetos.ts`; cálculo das Rotas (ritmo, previsão, recálculo, próximo passo, igual ao simulador do Book)
  em `src/lib/rotas.ts`; Estudos como ciclo de estudos (matérias com horas por ciclo, matéria → módulo → aula, revisões 1/7/30 dias, modo foco
  com pomodoro em `src/components/Foco.tsx`) em `src/lib/estudos.ts`; o curso tem palco (dias para a prova/entrega, semana,
  % do conteúdo, % de acerto, revisões) e abas Ciclo, Conteúdo (temas de cada matéria), Exercícios, Provas e notas e Desempenho
  (constância, horas por semana e por matéria) em `estudos/[id]/abas.tsx` e `src/components/Desempenho.tsx`. Não é app de concurso:
  textos genéricos (pós, faculdade, idioma, curso). Com as
  sessões como compromissos do Core (events com `course_id`); Rotinas (quando é dia dela, a semana em pontos, sem sequência; mensais "todo dia 10" ficam no Hoje até serem feitas)
  em `src/lib/rotinas.ts`; Notas (onde mora, rótulo, data) em `src/lib/notas.ts`; Finanças do mês (resumo, contas fixas = rotinas mensais com valor,
  categorias, planilha CSV; o mês é o do calendário, 1 a 30, em tudo; parcelamentos,
  investimentos com projeção, envelopes parcelas/investir/livre, saldo da conta somado a partir do informado) em `src/lib/financas.ts`; abas Mês (faixa dos 12 meses, entrou/saiu/investiu/ainda pode gastar, o que falta pagar para marcar, o extrato
  por dia, a divisão e as categorias), Parcelas
  (grade parcela por parcela), Investimentos e Resumo (categoria por mês), com as tabelas em `src/components/FinancasPlanilha.tsx`; Saúde (remédio = rotina com dose, um horário por rotina; consultas = compromissos
  com `health_kind`; medidas e tendência) em `src/lib/saude.ts`, página `/saude`; Negócios em `/negocios`: quadro com uma coluna por empresa e "Para classificar" (o Inbox), arrastar muda a
  empresa (`src/components/QuadroNegocios.tsx`); `?e=<id>` mostra uma empresa (por prazo, retornos, decisões, reuniões). Subtarefas em `src/lib/subtarefas.ts` e `src/components/Subtarefas.tsx`; nas páginas do servidor, use `<Lista>` (`src/components/Lista.tsx`), que
  busca o "2/5" das subtarefas. Ações do servidor em `src/app/(app)/acoes.ts`.
- Antes de escrever de novo, reaproveite: datas, fuso de São Paulo, nomes de dias e meses, `ehId` e `numeroBR` em
  `src/lib/datas.ts`; `CampoContexto`, `Painel` (painel por cima da tela) e `AdicionarRapido` em `src/components/Comuns.tsx`;
  o logo oficial em `src/components/Logo.tsx`; o anel e o caminho das Rotas em `src/components/Caminho.tsx`.
- Notificações (web push): `public/sw.js`, cartão em Ajustes (`src/components/Notificacoes.tsx`, chave pública em
  `src/lib/avisos.ts`), ações `salvarInscricao`/`apagarInscricao`/`testarAviso`. O envio é a função do Supabase
  `supabase/functions/avisos` (resumo 7h30, compromisso 15 min antes, remédio/rotina no horário, contas e parcelas 9h;
  `?simular=1&hora=HH:MM` mostra sem enviar). Chaves VAPID e token no cofre (vault) do Supabase, nunca no repositório.
  No iPhone só funciona com o Rumo adicionado à Tela de Início.
- Publicação: a Vercel publica a `main` em produção (rumo-iter-midia.vercel.app). O Daniel autorizou levar à
  `main` cada etapa terminada e conferida.
- Variáveis: `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ver `.env.example`).

## Como trabalhar neste repositório

- Antes de dizer que algo está pronto: `npm run build` sem erros e a tela aberta no navegador.
- Commits pequenos, mensagem em português dizendo o que muda para o Daniel.
- O Daniel autorizou levar à `main` cada etapa terminada e conferida (a Vercel publica a `main`).
