# Rumo · contexto para o Claude Code

Rumo é um **sistema operacional pessoal modular**. Promessa: **Clareza para o seu próximo passo.**
Proposta comercial: *Tudo o que depende de você, em um só lugar.*
Dono do produto: Daniel. Toda a comunicação, interface e textos do app são em **português do Brasil**.

## Antes de qualquer tarefa

1. Leia **`docs/rumo-completo.md` inteiro**. É a explicação completa do Rumo: marca e voz, problema e
   estratégia, público, Core (Hoje, Inbox, Responsabilidades, Calendário, Projetos, Busca), arquitetura
   modular, cada módulo, Rotas, Connect, as perguntas do começo, identidade visual, interface e
   componentes, mercado, futuro e o que o MVP constrói. Sem entender o todo, não construa nenhuma parte.
2. Para construir ou mudar uma tela, abra a imagem correspondente em `docs/telas/` (Hoje, visão por
   contexto, calendário, mobile e componentes) e compare o resultado com ela.
3. Para escopo, dados e regras, `docs/mvp.md`; para as perguntas do começo, `docs/onboarding.md`;
   resumo rápido em `docs/LEIA-PRIMEIRO.md`.

Tudo isso está no repositório: o *Brand & Product Book v1.0* (interativo em `docs/brand-book/index.html`,
em texto em `docs/book/`) e a *Especificação do MVP* (`docs/mvp.md`). Este arquivo resume o essencial.

## O que é o MVP

O Core para o **uso diário do Daniel**, num teste de 90 dias. A hipótese: ele passa a confiar no Rumo
como o lugar onde mora tudo o que depende dele e abre o Hoje todo dia.

Entra: Perguntas do começo (onboarding adaptativo, `docs/onboarding.md`) · Hoje · Captura rápida + Inbox · Responsabilidades com follow-up · Contextos (Iter Mídia, Rumo, Casa…)
· Projetos · Calendário simples · Busca · nota de texto em responsabilidades e projetos.

O Rumo é **modular**: as perguntas do começo ligam os módulos e criam os contextos de cada pessoa. Entenda o
todo em `docs/rumo-completo.md` antes de construir qualquer parte, e construa pronto para os módulos entrarem
(lista de módulos em código, barra lateral montada pelo perfil).

**Fica fora (não construir sem o Daniel pedir):** Connect, IA/MCP, vários usuários na interface, sincronização com
Google Agenda, captura pelo WhatsApp. (Rotas, Estudos, Contextos sob medida, Rotinas e Notas: o Daniel pediu, ver as fases 4 a 8.)

## Fases

| Fase | Entrega | Situação |
| --- | --- | --- |
| 0 · Fundação | Login com e-mail e senha (Supabase), banco com RLS, PWA instalável, casca de navegação | Feita |
| 1 · Capturar | Captura que lê o texto, Inbox, Responsabilidades, Contextos | Em revisão com o Daniel |
| 1b · Começo | Perguntas do começo: o que organizar, contextos e módulos, barra lateral montada pelo perfil (`docs/onboarding.md`) | Em revisão com o Daniel |
| 2 · Hoje | Tela Hoje, follow-up e cobrança, notificações | Em revisão (falta: notificações) |
| 3 · Completar o Core | Projetos, Calendário, Busca, visão por contexto | Em revisão com o Daniel |
| 4 · Rotas | Destino → ritmo → marcos → próximo passo no Hoje; recalcula sem culpa (`docs/plano-modulos.md`) | Em revisão com o Daniel |
| 5 · Estudos | Matérias, ciclos, sessões no calendário e no Hoje, progresso | Em revisão com o Daniel |
| 6 · Contextos sob medida | Painel do contexto que se monta pelo conteúdo, sem configurar nada (empresa: retornos e decisões; área: rotinas e lembretes do mês) | Em revisão com o Daniel |
| 7 · Rotinas e hábitos | Recorrências que aparecem no Hoje na hora certa, semana sem culpa | Em revisão com o Daniel |
| 8 · Notas | Notas e decisões vinculadas | Em revisão com o Daniel |

Público inicial (avaliação de 20/11/2026, `docs/publico.md`): quem leva várias frentes ao mesmo tempo (trabalho, estudo,
saúde, um objetivo), com organização pessoal; depois profissionais liberais. Decisão do Daniel (19/11/2026): construir os módulos (fases 4 a 8) antes do teste de 90 dias, começando pelas
Rotas; notificações depois. Plano em `docs/plano-modulos.md`. Cada fase termina com algo que ele usa e aprova.

## Regras do produto

- Responsabilidade tem 3 estados: `a_fazer`, `aguardando`, `concluida`. **"Atrasada" não é estado**: é
  exibição quando o prazo passou.
- `aguardando` exige quem (pessoa ou texto) e `follow_up_on` (padrão: 3 dias úteis). No dia da cobrança,
  volta para o Hoje em "Atenção" e notifica.
- Sem contexto = Inbox. Com contexto e sem data = Responsabilidades. Com data = aparece no Hoje no dia.
- A captura entende: hoje, amanhã, dias da semana, datas (12/11), horas (10h, 14:30) e `#contexto`.
  O que não entender fica no título, sem erro. Meta: anotar em menos de 5 segundos. Guardar o texto
  original em `raw_capture`.
- Ordem do Hoje: 1) próximo passo (primeiro item de Atenção, ou compromisso em menos de 2 h);
  2) Atenção (atrasadas + follow-ups do dia); 3) Hoje (prazo hoje ou marcadas, por horário);
  4) Agenda do dia; 5) Aguardando alguém (recolhido).
- Decisões são responsabilidades com `kind = 'decidir'`; a decisão fica na nota ao concluir.
- **Atraso sem alarme**: texto e tom discreto, nunca vermelho chapado nem contador de culpa.
- Regra de produto (filtro para qualquer funcionalidade nova): melhora a clareza? ajuda a organizar o
  que depende da pessoa? a saber o que importa agora? a chegar onde ela quer? facilita o próximo passo?
  Se não responder sim a nenhuma, não entra.

## Identidade visual

- Fonte Inter (local em `public/fonts`). Paleta: Deep `#2B1E4B`, Purple `#6C4ED9`, Lavender `#DCCEF6`,
  Warm `#F8F7F4`, Charcoal `#1F1F1F`, Gray `#A7A0B3` (Gray nunca em texto: contraste baixo).
- Tokens em `src/app/globals.css`, com tema claro e escuro (escuro tem paleta própria, não é inversão).
  O tema vem de `data-theme` no `<html>`; a pessoa escolhe Claro, Escuro ou Auto (segue o aparelho), guardado
  no navegador (`src/lib/tema.ts`, `src/components/Tema.tsx`).
- Direção visual: a do Book. Os estilos seguem os tokens oficiais (`docs/brand-book/tokens/tokens.css`) e as
  telas conceituais (`docs/brand-book/assets/css/product.css`, "Direção 2026": menos caixas, hierarquia por tipo
  e espaço). Lateral e barra do celular em Deep (componente Sidebar do Book), item ativo em Purple; título de
  tela 28/600; linhas leves sem cartão; o Próximo passo é o único bloco com destaque; captura num painel claro
  (folha no celular) com os trechos entendidos marcados no próprio texto. Sem brilhos de fundo, sem degradê
  fora da lateral e do item ativo, sem peso 700.
- Logo: só os SVGs oficiais em `public/brand` (pacote rumo-brand-assets-v1). Nunca redesenhar ou recriar o logo.
- Direção das telas (Book, cap. 11): hierarquia por tipografia e espaço, um destaque por tela, propriedades
  em linha (contexto, prazo, origem) em vez de colunas, cor de contexto (bolinha) e roxo só para ação,
  teclado em primeiro plano (⌘K, atalhos), sombras suaves e linhas de 1 px.
- Voz: clara, calma, direta. Microcopy curta. Sem gamificação, sem exclamações, sem culpa.

## Tecnologia

- Next.js 15 (App Router, `src/`), TypeScript, CSS próprio (sem Tailwind), ícones `lucide-react`.
- Login: cadastro e entrada com e-mail e senha (`src/app/login/page.tsx`), sem link por e-mail. No Supabase,
  "Confirm email" deve ficar desligado para a conta valer na hora.
- Supabase via `@supabase/ssr`: `src/lib/supabase/{client,server,middleware}.ts`; `src/middleware.ts`
  protege as rotas (públicas: `/login`, `/auth`).
- Banco: projeto Supabase `rumo` (região São Paulo). `supabase/migrations/0001_core.sql` (contexts, people, projects,
  responsibilities, events, todas com `user_id` e RLS "dono lê/cria/altera/apaga"); 0002 (pg_trgm no schema
  `extensions`, search_path fixo no gatilho), 0003 (índices das chaves estrangeiras) e 0004 (`profiles`: nome,
  módulos e respostas do começo) 0005 (Rotas: `routes`, `route_milestones`, `route_entries`, e `route_id`/`milestone_id`
  em responsibilities) e 0006 (Estudos: `study_courses`, `study_subjects`; `course_id`, `subject_id` e `done_at` em events;
  `course_id` em routes) e 0007 (Rotinas: `routines`, com dias fixos ou N vezes por semana, e `routine_checks`, um registro
  por dia feito) e 0008 (Notas: `notes`, nota ou decisão com porquê e data, ligada a contexto, projeto ou curso) e 0009 (ciclo de estudos: `cycle_minutes` nas matérias, `study_topics` com os temas,
  `topic_id` nas sessões) e 0010 (rotinas mensais: `month_day`, uma frequência por rotina) já aplicadas. Mudanças de banco = **nova migração numerada**, nunca editar
  a anterior depois de aplicada.
- Rotas do app em `src/app/(app)/…`; o layout manda para `/comecar` quem ainda não respondeu as perguntas do
  começo. A casca (`src/components/Shell.tsx`) monta a lateral pelo perfil e pelos contextos (Negócios = tipo
  empresa, Áreas = tipo área). Módulos em `src/lib/modulos.ts`; o Hoje é montado por `src/lib/hoje.ts`;
  semana do calendário em `src/lib/semana.ts`; resumo de projeto (progresso, entrega, próximo passo) em
  `src/lib/projetos.ts`; cálculo das Rotas (ritmo, previsão, recálculo, próximo passo, igual ao simulador do Book)
  em `src/lib/rotas.ts`; Estudos como ciclo de estudos (matérias com horas por ciclo, temas, matéria da vez, semana) em `src/lib/estudos.ts`, com as
  sessões como compromissos do Core (events com `course_id`); Rotinas (quando é dia dela, a semana em pontos, sem sequência; mensais "todo dia 10" ficam no Hoje até serem feitas)
  em `src/lib/rotinas.ts`; Notas (onde mora, rótulo, data) em `src/lib/notas.ts`. Ações do servidor em `src/app/(app)/acoes.ts`.
- Antes de escrever de novo, reaproveite: datas, fuso de São Paulo, nomes de dias e meses, `ehId` e `numeroBR` em
  `src/lib/datas.ts`; `CampoContexto`, `Painel` (painel por cima da tela) e `AdicionarRapido` em `src/components/Comuns.tsx`;
  o logo oficial em `src/components/Logo.tsx`; o anel e o caminho das Rotas em `src/components/Caminho.tsx`.
- Publicação: a Vercel publica a `main` em produção (rumo-iter-midia.vercel.app). O Daniel autorizou levar à
  `main` cada etapa terminada e conferida.
- Variáveis: `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ver `.env.example`).

## Acabamento pedido pelo Daniel (fazer depois das funcionalidades)

- Login: o lado direito está "seco". Ele quer algo vivo ali: imagem de fundo com o logo e a assinatura, ou um
  vídeo curto em loop. (Atenção ao Book: movimento não chama atenção sozinho; respeitar `prefers-reduced-motion`.)
- Transições suaves nas seleções: feito (o destaque dos segmentados desliza; o título do login troca com fade;
  respeita `prefers-reduced-motion`). Aguardando o Daniel ver.

## Como trabalhar neste repositório

- Antes de dizer que algo está pronto: `npm run build` sem erros e a tela aberta no navegador.
- Commits pequenos, mensagem em português dizendo o que muda para o Daniel.
- Na dúvida sobre escopo, pergunte ao Daniel em vez de construir algo fora do MVP.
