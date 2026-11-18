# O Rumo em uma página

Leia isto antes de qualquer tarefa neste repositório. Aqui está quem é o Rumo, para quem ele existe e
como ele deve parecer e soar. Os detalhes estão nos arquivos listados no fim.

## O que é

Rumo é um **sistema operacional pessoal modular**. Ele junta num lugar só tudo o que depende de uma
pessoa (responsabilidades, projetos, compromissos, retornos que ela espera dos outros) e deixa claro:

1. o que exige atenção agora;
2. onde cada coisa pertence;
3. qual é o próximo passo.

Não é um gerenciador de tarefas com mais funções. É uma camada de clareza por cima da vida da pessoa.

- **Promessa (assinatura):** Clareza para o seu próximo passo.
- **Proposta comercial:** Tudo o que depende de você, em um só lugar.
- **Essência:** direção. **Ideia central:** organizar o rumo da sua vida.

## O problema que ele resolve

> "Tudo depende de mim, mas tudo está espalhado."

As responsabilidades de uma pessoa ficam espalhadas entre empresas, projetos, pessoas, WhatsApp,
agendas, anotações, planilhas, sistemas e a própria memória. Com isso, ela perde clareza justamente
sobre o que mais precisa saber: o que depende dela, quando agir, o que atrasou, o que está esperando
outra pessoa, qual contexto pede atenção e o que fazer agora.

## Para quem

O primeiro usuário é o **Daniel**: ele coordena uma agência (Iter Mídia), um produto (o próprio Rumo) e a
vida pessoal (Casa), recebe demandas de vários lados e depende demais da memória. O MVP é para ele usar
todo dia por 90 dias.

Depois, o público inicial são donos, sócios e gestores com muitas frentes ao mesmo tempo. O produto é
horizontal (serve a qualquer pessoa com muitas responsabilidades); a entrada no mercado é vertical
(começa por donos e gestores).

## Como o produto se organiza

- **Core**, igual para todos: Hoje, Inbox, Calendário, Responsabilidades, Projetos, Busca.
  É o que o MVP constrói.
- **Contextos**: cada empresa ou área da vida (Iter Mídia, Rumo, Casa…) tem uma cor. Toda
  responsabilidade pertence a um contexto; sem contexto, ela fica na Inbox.
- **Follow-up é um estado, não uma tela.** "Aguardando alguém" tem pessoa e data de cobrança; no dia, a
  responsabilidade volta ao Hoje.
- **Módulos** (Negócios, Estudos, Rotinas, Notas, Rotas), **Connect** (receber itens de outros sistemas,
  como o Vértice, que organiza a Iter) e IA são a visão futura. **Não entram no MVP.** Eles aparecem no
  Book e nas telas conceituais; ignore essas partes ao construir.

## O coração: a tela Hoje

O Hoje responde uma pergunta só: **"O que precisa da minha atenção agora?"** Veja
`docs/telas/tela-hoje.png`. Repare:

- saudação pequena ("Boa tarde, Daniel"), título grande, uma frase-resumo com números
  ("Uma reunião em 40 minutos, uma responsabilidade atrasada e dois retornos aguardando.");
- **um único bloco em destaque**: o Próximo passo, com o porquê ("Reunião às 14:00 · em 40 min") e duas
  ações ("Adiar", "Começar");
- depois, listas leves: Atenção, Hoje, Agenda à direita;
- cada item é uma linha: círculo para concluir, título, e abaixo uma linha discreta de propriedades
  (bolinha do contexto + nome, prazo, projeto). No máximo uma etiqueta à direita;
- atraso aparece só no texto do prazo ("Venceu ontem"), sem alarme;
- dicas de teclado no rodapé (C nova · ↑↓ navegar · E concluir · ⌘K comandos).

Todas as outras telas seguem essa mesma gramática.

## Como deve parecer

Produto pessoal premium, calmo e preciso. Nunca um painel cheio de widgets nem um modelo pronto.

1. Hierarquia por tipografia e espaço. Caixas só quando agrupam algo de verdade.
2. Um destaque por tela.
3. Propriedades em linha, não colunas de tabela.
4. Cor de contexto (bolinha) para dizer "onde"; roxo só para ação.
5. Sombras longas e suaves, linhas de 1 px. Nada de gradiente pesado ou chanfro.
6. Teclado em primeiro plano.
7. Claro e escuro de verdade; o escuro tem paleta própria.

A direção visual que o Daniel aprovou em novembro de 2026 (lateral em Deep, trilho de cor por contexto,
captura num painel Deep) está no CLAUDE.md. Onde ela e o Book divergem, vale o CLAUDE.md.

**Premium sem ser luxuoso. Tecnológico sem ser futurista. Organizado sem ser burocrático. Completo sem
ser intimidante. Sério sem ser frio.**

## Como deve soar

O Rumo fala como uma pessoa competente que respeita o tempo de quem ouve: claro, objetivo, tranquilo,
humano. Informa e oferece escolha; nunca julga.

| Evitar | Preferir |
| --- | --- |
| Vamos dominar seu dia! | 6 responsabilidades para hoje. |
| Você falhou em concluir 3 tarefas. | 3 responsabilidades ficaram para amanhã. Quer reagendar? |
| ATRASADO! | Venceu ontem. Reagendar ou concluir? |
| Uhul! Você zerou tudo! | Nada pendente nesta etapa. |
| Ops! Algo deu errado 😕 | Não foi possível salvar. Verifique a conexão e tente de novo. |
| Clique aqui / OK | Criar projeto · Revisar a semana |

- Frases curtas, voz ativa, números em algarismo ("3 pendentes", "em 2 dias").
- Botões com verbo e objeto. Só a primeira letra maiúscula ("Próximo passo").
- Sem exclamação, sem emoji, sem gamificação, sem culpa.
- O app chama as coisas de **responsabilidade** (não "tarefa"), **contexto**, **próximo passo**,
  **atenção**, **aguardando**. A palavra "Rumo" quase não aparece dentro do app.

## Quando estiver em dúvida

- Sobre uma funcionalidade nova, faça as cinco perguntas: melhora a clareza? Ajuda a organizar o que
  depende da pessoa? A saber o que importa agora? A chegar onde ela quer? Facilita o próximo passo?
  Se nenhuma resposta for sim, não entra.
- Sobre escopo ou gosto, pergunte ao Daniel antes de construir.
- Sobre aparência, abra a tela conceitual correspondente em `docs/telas/` e compare.

## Onde está cada coisa

| Para… | Leia |
| --- | --- |
| Escopo, telas, dados, regras e fases do MVP | `docs/mvp.md` |
| Marca, voz, vocabulário, microcopy por estado | `docs/book/01-marca.md` |
| O problema, os seis verbos, o que o Rumo não é | `docs/book/02-estrategia.md` |
| Público e personas | `docs/book/03-publico.md` |
| Core: Hoje, Responsabilidades, follow-up, Inbox, captura, Calendário | `docs/book/04-produto.md` |
| Cor, tipografia, forma, ícones, movimento | `docs/book/10-identidade.md` |
| Direção das telas e componentes | `docs/book/11-interface.md` |
| Como as telas conceituais e os componentes parecem | `docs/telas/*.png` |
| O Book completo e interativo (abrir no navegador) | `docs/brand-book/index.html` |
| Tokens oficiais (cor, tipo, espaço, raio, sombra) | `docs/brand-book/tokens/tokens.css` |

Os capítulos 05 a 09 e 12 a 14 do Book (arquitetura, módulos, Rotas, Connect, onboarding, mercado,
futuro) são contexto de longo prazo. Leia para entender a visão, não para construir agora.
