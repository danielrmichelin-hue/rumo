# O Rumo inteiro

Este documento explica o Rumo como produto completo, do primeiro acesso ao uso de todo dia, e mostra onde
o MVP entra nessa história. Leia depois do `LEIA-PRIMEIRO.md`. Quem constrói qualquer parte do app precisa
entender o todo, mesmo construindo só uma fatia.

## A ideia em uma frase

Cada pessoa tem uma vida diferente, mas o problema é o mesmo: tudo o que depende dela está espalhado.
O Rumo junta isso num lugar só e **se monta do jeito da vida de cada um**. Não existem aplicativos
diferentes para o empresário e para a estudante: existe um Rumo só, com um Core igual para todos e
módulos que se ligam conforme as respostas da pessoa no começo.

> Um Rumo diferente para cada vida.

## As camadas do produto

```
          Perguntas do começo (onboarding adaptativo)
                         │  decidem
                         ▼
   ┌──────────── Módulos (ligados conforme a vida) ────────────┐
   │ Negócios · Estudos · Rotinas & Hábitos · Notas · Rotas     │
   └───────────────────────────┬────────────────────────────────┘
                               │  tudo o que produzem vira
                               ▼
   ┌──────────────────────── Core (igual para todos) ──────────┐
   │ Hoje · Inbox · Calendário · Responsabilidades · Projetos · │
   │ Busca  +  Contextos  +  follow-up                          │
   └───────────────────────────┬────────────────────────────────┘
                               ▲  chegam pela Inbox, com origem
          Connect (opcional): Vértice, agendas, outros sistemas
          IA / MCP (futuro): um assistente que consulta e atualiza
```

1. **Core**: igual para todos, não pode ser desligado. Hoje, Inbox, Calendário, Responsabilidades,
   Projetos e Busca. Mais duas capacidades que atravessam tudo: **contextos** (cada empresa ou área da
   vida, com sua cor) e **follow-up** (aguardar alguém é um estado da responsabilidade, não uma tela).
2. **Módulos**: trazem a linguagem de uma área da vida, mas não são apps separados. Tudo o que um módulo
   cria vira responsabilidade, compromisso, projeto ou próximo passo do Core, e chega ao Hoje na hora
   certa. Um módulo desligado não deixa rastro: sem menu vazio, sem ícone cinza, sem convite permanente.
3. **Perguntas do começo**: decidem quais módulos ligar e quais contextos criar. A pessoa nunca vê uma
   lista de módulos com nomes técnicos; ela responde "o que você quer organizar?".
4. **Connect** (opcional, futuro): sistemas externos mandam para a Inbox o que depende da pessoa, com a
   origem visível ("via Vértice"). O Rumo recebe, não comanda.
5. **IA e MCP** (futuro): uma camada a mais. Tudo o que um assistente faz, a pessoa consegue fazer direto.

## A jornada de uma pessoa

1. **Cria a conta** com e-mail e senha.
2. **Responde as perguntas do começo** (detalhe em `docs/onboarding.md`). Marca o que quer organizar:
   Trabalho, Meus negócios, Estudos, Vida pessoal, Rotinas e hábitos, Objetivos e metas, Projetos
   pessoais. Para cada escolha, uma pergunta curta: "Quais empresas você quer acompanhar?", "Quais áreas
   da vida pessoal?". Enquanto responde, vê a barra lateral se montando ao lado.
3. **Chega ao primeiro Hoje já fazendo sentido**: a navegação tem os contextos dela (Iter Mídia, Rumo,
   Casa…), cada área vazia explica o primeiro passo, e o botão de capturar está à mão.
4. **No dia a dia, captura em segundos**: "Ligar pro contador sexta 10h #Iter". O Rumo entende data, hora e
   contexto. Sem contexto, vai para a Inbox.
5. **Organiza a Inbox uma vez por dia**: dá contexto, data e estado a cada item num gesto.
6. **Abre o Hoje toda manhã** e vê: o próximo passo em destaque, o que pede atenção (atrasadas e
   retornos a cobrar), o que é de hoje, a agenda e quem ela está esperando.
7. **Acompanha o que depende dos outros**: marca "aguardando" com quem e quando cobrar; no dia, o item
   volta para o Hoje.
8. **Olha cada contexto** quando precisa: a visão da Iter Mídia mostra abertas, atrasadas, aguardando e a
   próxima reunião.
9. **Muda o que organiza quando a vida muda**: começou uma pós, liga Estudos; parou, desliga.

## O Core por dentro

| Parte | Responde | Essência |
| --- | --- | --- |
| Hoje | O que precisa da minha atenção agora? | Um destaque (próximo passo) e listas leves |
| Inbox | Onde jogo o que acabou de chegar? | Captura antes de organizar |
| Responsabilidades | O que é meu? | Fazer, decidir ou acompanhar, por contexto |
| Projetos | O que tem começo e fim? | Responsabilidades agrupadas, com progresso |
| Calendário | Quando? | Compromissos e prazos da semana |
| Busca | Onde anotei isso? | Tudo, por ⌘K |
| Contextos | De qual parte da minha vida é isso? | Empresa ou área, com uma cor |

Uma responsabilidade tem 3 estados: a fazer, aguardando alguém, concluída. Atrasada é só como ela aparece
quando o prazo passou. Decisão é uma responsabilidade do tipo "decidir".

## Os módulos

| Módulo | Para quem | O que organiza | Como chega ao Hoje |
| --- | --- | --- | --- |
| **Negócios** | Dono, sócio, gestor | A parte de cada empresa que depende da pessoa: responsabilidades, decisões, compromissos, projetos, acompanhamentos. Não é ERP nem CRM | Itens com a cor da empresa |
| **Estudos** | Quem estuda | Matérias, ciclos, aulas, leituras, sessões, progresso | Sessão de estudo no horário |
| **Rotinas & Hábitos** | Quem quer manter algo | Recorrências e frequência realista ("4 vezes por semana"), sem medalha nem sequência que quebra | A rotina aparece na hora dela |
| **Notas** | Todos | Anotações, decisões e referências sempre ligadas a algo | Nota vinculada ao item |
| **Rotas** | Quem tem um objetivo | Destino → rota → marcos → próximos passos. Calcula o ritmo; se a vida muda, recalcula sem punir | O passo da semana, com o anel de progresso |

No MVP, **Negócios** existe na forma mínima: contextos do tipo empresa, com a visão por contexto. **Notas**
existe como um campo de texto em responsabilidades e projetos. Estudos, Rotinas e Rotas vêm depois.

Imagens: `docs/telas/modulos-navegacao.png` (ligar um módulo muda a navegação e o que chega ao Hoje) e
`docs/telas/onboarding-perguntas.png` (as perguntas do começo montando a navegação).

## Rumo e Vértice

O Vértice é o sistema que organiza a empresa do Daniel (a Iter Mídia): clientes, entregas, equipe,
processos. O Rumo organiza a pessoa. São marcas e produtos separados. No futuro, o Vértice manda para a
Inbox do Rumo só o que tem o Daniel como responsável, com a etiqueta "via Vértice". O que é pessoal no
Rumo nunca volta para o Vértice. O Rumo funciona por completo sem o Vértice.

## O que o MVP constrói desta história

| Parte | No MVP |
| --- | --- |
| Cadastro e perguntas do começo | Sim. As 7 opções e as perguntas de cada uma; cria contextos e projetos a partir das respostas e guarda o resto (`docs/onboarding.md`) |
| Core: Hoje, Inbox, Responsabilidades, Projetos, Calendário, Busca, Contextos, follow-up | Sim |
| Negócios | Forma mínima: contextos do tipo empresa e a visão por contexto |
| Notas | Forma mínima: campo de texto |
| Estudos, Rotinas, Rotas | Não. A escolha fica guardada; os menus aparecem quando o módulo existir |
| Connect, IA, MCP | Não |

## Como construir pensando no todo

Mesmo construindo só o MVP, o código precisa estar pronto para os módulos entrarem sem refazer nada:

- **Uma lista de módulos no código** (por exemplo `src/lib/modulos.ts`): chave, nome, ícone, grupo da barra
  lateral e se já está disponível. A barra lateral se monta a partir dessa lista e das escolhas da pessoa,
  não de uma lista fixa de links.
- **As escolhas da pessoa ficam no banco** (perfil: módulos ligados e respostas do começo), não no
  navegador.
- **Tudo converge para as tabelas do Core.** Um módulo novo cria responsabilidades, projetos e
  compromissos; não cria uma lista paralela que o Hoje e a Busca não enxergam.
- **Módulo desligado some por inteiro**: rota, menu, contador e sugestão.
- **Contexto é da pessoa, módulo é do produto**: a cor fica para os contextos; módulos se diferenciam
  por ícone e nome.

## Perguntas que ajudam a decidir

Antes de criar qualquer coisa, pergunte se ela ajuda a pessoa a **entender** (onde estou?), **organizar**
(o que importa agora?), **avançar** (qual é o próximo passo?) ou **direcionar** (para onde estou indo?).
Se não ajuda em nenhum dos quatro, não entra.
