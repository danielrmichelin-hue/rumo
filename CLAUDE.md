# Rumo · contexto para o Claude Code

Rumo é um **sistema operacional pessoal modular**. Promessa: **Clareza para o seu próximo passo.**
Proposta comercial: *Tudo o que depende de você, em um só lugar.*
Dono do produto: Daniel. Toda a comunicação, interface e textos do app são em **português do Brasil**.

## Antes de qualquer tarefa

1. Leia **`docs/LEIA-PRIMEIRO.md`**: quem é o Rumo, o problema, a tela Hoje, como deve parecer e soar,
   e o mapa dos outros documentos.
2. Para construir ou mudar uma tela, abra a imagem correspondente em `docs/telas/` (Hoje, visão por
   contexto, calendário, mobile e componentes) e compare o resultado com ela.
3. Para escopo, dados e regras, leia `docs/mvp.md`. Para marca e voz, `docs/book/01-marca.md`.

Tudo isso está no repositório: o *Brand & Product Book v1.0* (interativo em `docs/brand-book/index.html`,
em texto em `docs/book/`) e a *Especificação do MVP* (`docs/mvp.md`). Este arquivo resume o essencial.

## O que é o MVP

O Core para o **uso diário do Daniel**, num teste de 90 dias. A hipótese: ele passa a confiar no Rumo
como o lugar onde mora tudo o que depende dele e abre o Hoje todo dia.

Entra: Hoje · Captura rápida + Inbox · Responsabilidades com follow-up · Contextos (Iter Mídia, Rumo, Casa…)
· Projetos · Calendário simples · Busca · nota de texto em responsabilidades e projetos.

**Fica fora (não construir sem o Daniel pedir):** Rotas, Estudos, Rotinas, Connect, IA/MCP, onboarding
adaptativo, vários usuários na interface, sincronização com Google Agenda, captura pelo WhatsApp.

## Fases

| Fase | Entrega | Situação |
| --- | --- | --- |
| 0 · Fundação | Login com e-mail e senha (Supabase), banco com RLS, PWA instalável, casca de navegação | Feita |
| 1 · Capturar | Captura que lê o texto, Inbox, Responsabilidades, Contextos | Em revisão com o Daniel |
| 2 · Hoje | Tela Hoje, follow-up e cobrança, notificações | Próxima |
| 3 · Completar o Core | Projetos, Calendário, Busca, visão por contexto | — |

O teste com o Daniel começa quando a fase 2 estiver pronta. Cada fase termina com algo que ele usa e aprova.

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
- Direção visual aprovada pelo Daniel (nov/2026): lateral e barra do celular sempre em Deep com o logo claro
  grande; títulos grandes e firmes; cada contexto é um trilho vertical na sua cor (bolinha, linha e caixas de
  seleção); captura num painel Deep com o que foi entendido em etiquetas; botão principal com o degradê do logo.
  Evitar cartões brancos flutuando com sombra (cara de modelo pronto).
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
  `extensions`, search_path fixo no gatilho) e 0003 (índices das chaves estrangeiras) já aplicadas. Mudanças de banco = **nova migração numerada**, nunca editar
  a anterior depois de aplicada.
- Rotas do app em `src/app/(app)/…`; a casca (`src/components/Shell.tsx`) carrega os contextos na lateral.
- Variáveis: `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ver `.env.example`).

## Como trabalhar neste repositório

- Antes de dizer que algo está pronto: `npm run build` sem erros e a tela aberta no navegador.
- Commits pequenos, mensagem em português dizendo o que muda para o Daniel.
- Na dúvida sobre escopo, pergunte ao Daniel em vez de construir algo fora do MVP.
