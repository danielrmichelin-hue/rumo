# Plano de implementação dos módulos

Depois do Core (fases 0 a 3), o Rumo ganha a cara de cada área da vida com os módulos do Book
(`docs/rumo-completo.md`, Partes 5 a 7). Decisão do Daniel (19/11/2026): seguir com os módulos antes do teste
de 90 dias, começando pelas Rotas. Notificações ficam para depois.

Regras que valem para todos os módulos (Parte 5 do Book):

- **Tudo converge para o Core.** O que um módulo cria vira responsabilidade, compromisso ou projeto, e chega
  ao Hoje sem a pessoa abrir o módulo. Nada de lista paralela que o Hoje e a Busca não enxergam.
- **Módulo desligado não deixa rastro.** O menu de um módulo só aparece quando ele está ligado no perfil.
- **Mesma linguagem visual.** Módulos se diferenciam por ícone e nome; a cor é dos contextos.
- **Sem gamificação.** Nada de pontos, medalhas ou sequências que quebram. Desvio é informação.

## Fase 4 · Rotas (em revisão com o Daniel)

Do destino ao próximo passo. "Rumo não pune desvios. Rumo recalcula o caminho." Referências: Book cap. 07
(`docs/book/07-rotas.md`), simulador e tela conceitual em `docs/brand-book/index.html#rotas`.

**Dados (migração 0005):**
- `routes`: título, tipo (`financeiro`, `leitura`, `estudos`, `negocios`), contexto, destino (valor, páginas
  ou aulas), quanto já tem, ponto de partida (valor e data, base do ritmo planejado), data de chegada, estado
  (ativa, pausada, concluída), nota.
- `route_milestones`: marcos (Rotas de negócio): título, ordem, data prevista, concluído em.
- `route_entries`: registros de avanço ("guardei R$ 400", "li 30 páginas"), com data.
- `responsibilities.route_id` e `milestone_id`: os próximos passos são responsabilidades do Core.

**Cálculo (`src/lib/rotas.ts`), igual ao simulador do Book:**
- Financeiro: ritmo por mês = falta ÷ meses até a chegada. Próximo passo sugerido: "Transferir R$ X até o dia 5".
- Leitura: páginas por dia = falta ÷ dias. Próximo passo: "Ler N páginas hoje".
- Estudos: aulas por semana = falta ÷ semanas. Próximo passo: "Assistir N aulas esta semana".
- Negócios: marcos; ritmo = "1 marco a cada N semanas"; o marco atual mostra os passos dele.
- Recalcular: quando o ritmo necessário sobe, a Rota diz o que mudou e o novo ritmo ("A Rota foi recalculada:
  R$ 400 por mês, mesmo destino. Antes eram R$ 380."). Se o novo ritmo pesa demais (25% acima do planejado),
  oferece escolha: "Quer manter março ou mover a chegada para abril?".

**Telas:**
- `/rotas`: as Rotas em andamento, com o caminho em pontos e o ritmo em uma linha.
- `/rotas/nova`: escolher o tipo, informar os números e ver ao vivo o ritmo, a previsão e o próximo passo
  (como o simulador do Book). Usa a resposta das perguntas do começo ("Qual é o primeiro destino?").
- `/rotas/[id]`: destino, percentual, caminho, ritmo necessário, previsão, recálculo com escolha, próximos
  passos (vão para o Hoje), registrar avanço e histórico. Rota de negócio: marcos no topo e o marco atual aberto.
- Lateral: grupo Rotas com o anel de progresso. Hoje: "Rotas em andamento" ao lado da agenda e os passos da
  Rota com o anel. Busca encontra Rotas.

## Fase 5 · Estudos (refeita como ciclo de estudos, em revisão com o Daniel)

Matérias, ciclos, temas, sessões e progresso (Book 6.2). Refeita em 20/11/2026: o Daniel achou confusa a primeira
versão (módulos, aulas e "próxima aula" misturados) e vai começar um ciclo com várias matérias, horas e temas.

- **Ciclo de estudos:** cada matéria tem horas por ciclo, na ordem em que vai ser estudada. O Rumo mostra a matéria
  da vez (a primeira que ainda não chegou nas horas) e o tema seguinte dela. O ciclo fecha quando todas chegam nas
  horas: as horas voltam a zero e os temas continuam.
- **Temas:** a lista de cada matéria (o edital ou a ementa), colada de uma vez, um por linha. Marcar como visto.
- **Tempo:** vem das sessões concluídas. Há três jeitos de registrar: Começar e Concluir (cronômetro), Registrar
  estudo (o que já aconteceu) ou Marcar sessão (vai para o calendário e para o Hoje). Sessão marcada que passou sem
  ser concluída aparece em "Para confirmar" ("Estudei" ou "Não deu"), sem cobrança.
- **Hoje:** a seção Estudos traz a matéria da vez de cada estudo, com o tema e quanto falta no ciclo. Some quando já
  há sessão de estudo marcada para o dia.
- **Dados:** migração 0006 e 0009 (`cycle_minutes`, `study_topics`, `topic_id` nas sessões). Aulas contadas ficam
  opcionais, para cursos com aulas e para a Rota de estudos.

## Fase 6 · Contextos sob medida (painel automático, em revisão com o Daniel)

Pedido do Daniel (19/11/2026): "não pode ser tudo igual". Revisto em 20/11/2026 com o Book: o Rumo é um sistema pronto
(contra o "monte você mesmo"), não é o sistema da empresa, e ninguém deve configurar o que vê em cada contexto.

- **Visão geral do contexto (nova aba padrão):** o próximo passo daquele contexto (mesma regra do Hoje; sem urgência,
  o primeiro da semana), Atenção, Esta semana, Aguardando outras pessoas, Para decidir, as rotinas e lembretes do mês
  daquele contexto, a agenda, Projetos, Rotas, Estudos e notas recentes. **Parte vazia não aparece**, então cada
  contexto fica com a cara do que tem dentro.
- **Empresa x área (tipo que já existe):** empresa começa pelos retornos e decisões ("O que você faz sempre aqui");
  área (saúde, casa, finanças) começa pelas rotinas e lembretes do mês.
- **Contexto vazio:** só a primeira ação (anotar com `#contexto` ou criar uma rotina), com o lembrete de que o que é
  da empresa fica no sistema dela.
- **Rotinas mensais (migração 0010):** "todo dia 10". Aparecem no Hoje no dia e ficam até serem feitas ("desde dia
  10", sem alarme); viram bloco no calendário quando têm horário.

## Fase 7 · Rotinas e hábitos (em revisão com o Daniel)

Recorrências e hábitos com horário (Book 6.3). Uma rotina aparece no Hoje quando é a hora dela e some quando
não é. Frequência realista ("4 vezes por semana"), acompanhamento da semana sem culpa, sem sequência que zera.

- **Dados (migração 0007):** `routines` (dias fixos ou N vezes por semana, horário, duração, contexto, pausada) e
  `routine_checks` (um registro por dia feito). Não existe contagem de sequência.
- **Regra:** dias fixos aparecem no Hoje nos dias deles; "N vezes por semana" aparece todo dia até a semana chegar
  na meta. Rotina com dia e horário vira bloco no calendário. Dias que já passaram podem ser marcados depois.
- **Telas:** `/rotinas` (criar, a semana em pontos, "3 de 4", ajustar e pausar); seção Rotinas no Hoje; grupo na
  lateral com "3/4"; Busca. As respostas das perguntas do começo (Academia, Leitura…) vêm preenchidas.

## Fase 8 · Notas (em revisão com o Daniel)

Notas vinculadas a uma empresa, projeto, matéria ou responsabilidade (Book 6.4). Decisões registradas com o
que foi decidido, por quê e quando.

- **Dados (migração 0008):** `notes` (nota ou decisão; título, texto, por quê, quando; ligada a contexto, projeto,
  curso ou responsabilidade). Projeto e curso levam o contexto junto, para a nota aparecer também lá.
- **Telas:** `/notas` (todas, com filtro Decisões/Notas); aba Notas na visão do contexto e decisões registradas na
  aba Decisões; seção Notas no projeto e no curso; Busca procura no título, no texto e no porquê. "Notas" aparece
  na lateral quando já existe alguma nota.
- As decisões que ainda vão ser tomadas continuam sendo responsabilidades (`kind = 'decidir'`).

## Depois

Notificações (fecham a fase 2), Connect com o Vértice, IA/MCP.
