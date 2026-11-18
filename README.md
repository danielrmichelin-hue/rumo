# Rumo

Sistema operacional pessoal modular. **Clareza para o seu próximo passo.**

Este repositório é o MVP descrito em *Rumo · Especificação do MVP*: o Core para uso diário
(Hoje, captura, Inbox, Responsabilidades com follow-up, Contextos, Projetos, Calendário e Busca).
A referência de marca e produto é o *Rumo · Brand & Product Book v1.0*.

## Tecnologia

- Next.js (App Router) + TypeScript, como app instalável (PWA) no celular e no computador
- Supabase: banco Postgres, login com e-mail e senha e segurança por usuário (RLS)
- Vercel: publicação automática a cada envio para a branch `main`

## Rodar no computador

1. Instale o Node 20 ou mais novo.
2. `npm install`
3. Copie `.env.example` para `.env.local` e preencha com os dados do projeto no Supabase.
4. Banco: o projeto Supabase `rumo` (São Paulo) já está criado com as migrações 0001 a 0003 aplicadas.
   Num projeto novo, rode os arquivos de `supabase/migrations/` em ordem no SQL Editor (ou `supabase db push`).
5. `npm run dev` e abra http://localhost:3000

No Supabase, em Authentication → URL Configuration, cadastre `http://localhost:3000/auth/callback`
e o endereço publicado (`https://<seu-app>.vercel.app/auth/callback`).

## Fases

| Fase | O que entrega | Situação |
| --- | --- | --- |
| 0 · Fundação | Login, banco, app instalável, identidade do Rumo | Feita |
| 1 · Capturar | Captura que lê o texto, Inbox, Responsabilidades, Contextos | Em revisão |
| 2 · Hoje | Tela Hoje, follow-up e cobrança, notificações | — |
| 3 · Completar o Core | Projetos, Calendário, Busca, visão por contexto | — |

Fontes: Inter (licença OFL, em `public/fonts`). Ícones: Lucide (licença ISC).
