# Rumo · Especificação do MVP

Versão no repositório do documento "Rumo · Especificação do MVP" (18/11/2026, Daniel).
Se este arquivo e o CLAUDE.md divergirem, vale o que estiver mais recente no CLAUDE.md.

O MVP do Rumo é o Core para o uso diário do Daniel: capturar algo em segundos, ver no Hoje o que importa
e acompanhar o que depende dos outros. Rotas, Estudos, Rotinas, Connect e IA ficam para depois, quando o
uso diário estiver provado.

## Escopo

O MVP prova uma hipótese só: o Daniel passa a confiar no Rumo como o lugar onde mora tudo o que depende
dele, e abre o Hoje todo dia. Tudo o que não ajuda a provar isso fica fora.

| Parte | No MVP | Por quê |
| --- | --- | --- |
| Hoje | Entra | É a tela que ele abre todo dia; sem ela não há teste |
| Captura rápida + Inbox | Entra | O maior risco: se anotar for mais lento que o WhatsApp, ele abandona |
| Responsabilidades com follow-up | Entra | "Aguardando alguém" é o que mais escapa hoje |
| Contextos (Iter Mídia, Rumo, Casa…) | Entra | É a versão mínima do módulo Negócios: cada coisa pertence a algo |
| Projetos | Entra | Agrupa responsabilidades com começo e fim |
| Calendário | Entra, simples | Compromissos e prazos do dia; sem sincronizar com o Google na v1 |
| Busca | Entra | Responde "onde eu anotei isso?" |
| Notas | Entra, mínimo | Um campo de texto em cada responsabilidade e projeto |
| Rotas, Estudos, Rotinas | Fica fora | Bons, mas não provam a hipótese principal |
| Connect, IA, MCP | Fica fora | Visão futura do Book |
| Onboarding adaptativo, vários usuários | Fica fora | O teste é só com o Daniel |

## Plataforma e tecnologia

Um app web instalável (PWA): o mesmo Rumo no celular e no computador, sem App Store na fase de teste.
No celular ele fica na tela inicial como um app e abre direto na captura.

| Peça | Escolha | Motivo |
| --- | --- | --- |
| Interface | Next.js + a identidade do Book (Inter, paleta, telas conceituais) | Um código só para celular e computador |
| Banco e login | Supabase (Postgres + autenticação), projeto `rumo` em São Paulo | Dados com segurança por usuário desde o início |
| Hospedagem | Vercel | Publicação automática a cada mudança |
| Código | github.com/danielrmichelin-hue/rumo | O código é do Daniel |
| Lembretes | Notificação do navegador (PWA) | Avisa follow-ups e prazos do dia |

O banco nasce preparado para vários usuários, mesmo com só o Daniel usando. Assim, abrir para 5 a 10
usuários beta não exige refazer nada.

## Telas

Oito telas, todas seguindo as telas conceituais do Book (capítulo 11; imagens em `docs/telas/`).

1. **Hoje**: responde "o que precisa da minha atenção agora?". No topo, o próximo passo em destaque.
   Abaixo: Atenção (atrasadas e follow-ups vencidos), Hoje (com prazo ou marcado para hoje), Agenda do dia
   e Aguardando alguém. Concluir com um toque. Referência: `docs/telas/tela-hoje.png`.
2. **Captura**: um botão + sempre visível. A pessoa escreve uma linha e o Rumo entende data, hora e
   contexto no próprio texto: "Ligar pro contador sexta 10h #Iter". Vai para a Inbox, ou direto para o
   lugar certo se já tiver contexto e data. Meta: anotar em menos de 5 segundos.
3. **Inbox**: o que foi capturado sem contexto. Organizar = escolher contexto, data e estado num gesto.
   A meta é esvaziá-la uma vez por dia.
4. **Responsabilidades**: tudo o que precisa ser feito, decidido ou acompanhado, filtrável por contexto,
   estado e prazo.
5. **Contexto** (um por empresa ou área: Iter Mídia, Rumo, Casa…): a visão empresarial do Book. Abertas,
   atrasadas, aguardando e próximo compromisso, com as abas Responsabilidades, Projetos, Decisões e
   Compromissos. Referência: `docs/telas/tela-visao-por-contexto.png`.
6. **Projetos**: lista de projetos com progresso; dentro, as responsabilidades e o próximo passo.
7. **Calendário**: semana com compromissos e prazos; responsabilidades sem horário ao lado.
   Referência: `docs/telas/tela-calendario.png`.
8. **Busca** (⌘K no computador): procura em tudo, em títulos, notas, contextos e pessoas.

## Dados

Cinco tabelas no Supabase (`supabase/migrations/`). Toda tabela tem dono (`user_id`), RLS e datas de
criação e alteração.

| Tabela | Campos principais | Observação |
| --- | --- | --- |
| contexts | nome, cor, tipo (empresa ou área), ordem, arquivado | Iter Mídia, Rumo, Casa… |
| responsibilities | título, nota, contexto, projeto, estado, prazo (data e hora opcional), marcada para hoje, aguardando quem, cobrar em, concluída em, origem (captura, manual), texto original | O centro do Rumo |
| projects | nome, contexto, estado (ativo, pausado, concluído), prazo, nota | Progresso = concluídas / total |
| events | título, contexto, início, fim, local, nota | O calendário da v1 |
| people | nome, contexto, contato | Só para o "aguardando quem" e a busca |

Decisões são responsabilidades do tipo "decidir", com a decisão registrada na nota quando concluídas.

## Regras

Uma responsabilidade tem três estados: **a fazer**, **aguardando alguém** e **concluída**. "Atrasada" não
é estado: é o que o Rumo mostra quando o prazo passou.

- **Aguardando alguém** pede quem e quando cobrar (padrão: 3 dias úteis). No dia da cobrança, volta para o
  Hoje em "Atenção" e avisa por notificação.
- **Atraso sem alarme**: texto e tom discreto, nunca vermelho chapado nem contador de culpa.
- **Sem contexto = Inbox.** Com contexto e sem data, vai para Responsabilidades; com data, aparece no Hoje
  no dia.
- **A captura entende**: hoje, amanhã, dias da semana, datas (12/11), horas (10h, 14:30) e #contexto.
  O que não entender fica no título, sem erro.

O Hoje se monta sempre nesta ordem:

1. Próximo passo: o primeiro item de "Atenção", ou o próximo compromisso se for em menos de 2 horas
2. Atenção: atrasadas e follow-ups no dia de cobrar
3. Hoje: prazo hoje ou marcadas para hoje, por horário
4. Agenda do dia
5. Aguardando alguém (recolhido)

## Etapas de construção

| Fase | Entrega | Semana (estimativa) |
| --- | --- | --- |
| 0 · Fundação | Login, banco com RLS, PWA instalável, casca de navegação | 1 |
| 1 · Capturar | Captura que lê o texto, Inbox, Responsabilidades, Contextos | 2 a 3 |
| 2 · Hoje | Tela Hoje, follow-up e cobrança, notificações | 4 |
| 3 · Completar o Core | Projetos, Calendário, Busca, visão por contexto | 5 a 6 |

O teste de 90 dias começa quando o Hoje e a captura funcionam (fim da fase 2). Projetos, Calendário e
Busca chegam enquanto o Daniel já usa. Cada fase termina com algo que ele usa e aprova. A situação atual
de cada fase está no CLAUDE.md.

## Como medir o teste

90 dias de uso real, com uma revisão curta toda sexta. O Rumo registra os números sozinho; o Daniel só
anota o que escapou.

| Sinal | Como medir | Bom sinal |
| --- | --- | --- |
| Volta ao Hoje | Dias por semana em que o Hoje foi aberto | Todo dia útil, sem esforço |
| Confiança na Inbox | Capturas por semana e quantas foram organizadas | Ele para de anotar no WhatsApp e em papel |
| Nada escapou | Coisas importantes que escaparam, anotadas na revisão de sexta | Cai semana a semana |
| Follow-up funciona | Retornos cobrados no dia certo | Nenhum retorno esquecido |
| Contextos | Empresas e áreas em uso | Iter, Rumo e vida pessoal no mesmo lugar |

Se depois de 4 semanas ele ainda não abre o Hoje todo dia, o problema está na captura ou no Hoje, não nos
módulos que faltam.

## Decisões tomadas

- Código no GitHub do Daniel (`danielrmichelin-hue/rumo`).
- Supabase: projeto novo só para o Rumo (`rumo`, São Paulo).
- Endereço durante o teste: subdomínio da Vercel.
- Captura pelo WhatsApp: depois do teste (exige integração paga e aprovação da Meta).
- Ainda em aberto: quais contextos vêm prontos no primeiro dia (pergunte ao Daniel).
