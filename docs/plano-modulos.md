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

## Fase 5 · Estudos (em revisão com o Daniel)

Matérias, ciclos, aulas, leituras, sessões e progresso (Book 6.2; tela conceitual em
`docs/brand-book/index.html#modulos`, aba Estudos).

- **Dados (migração 0006):** `study_courses` (curso: tipo, aulas, ciclo atual e total, horas por semana, prova,
  contexto) e `study_subjects` (matérias do ciclo, com aulas feitas e próxima aula). As **sessões são
  compromissos do Core** (`events` ganha `course_id`, `subject_id` e `done_at`): aparecem no calendário em azul
  de estudo, na agenda do Hoje e viram o Próximo passo quando faltam menos de 2 horas. **Leituras são Rotas de
  leitura** e a "Rota · Concluir a pós" é uma Rota de estudos (`routes.course_id`).
- **Tela do curso:** "Ciclo 4 de 8 · semana 2", aulas e prova, a semana em barras (horas feitas × planejadas),
  matérias do ciclo com progresso e a próxima aula, próxima sessão com Começar/Concluir, leituras e a Rota ligada.
- **Lateral:** grupo Estudos com cada curso. As perguntas do começo ("O que você estuda agora?") sugerem o tipo.

## Fase 6 · Contextos sob medida

Pedido do Daniel (19/11/2026): "não pode ser tudo igual". Cada empresa e cada área precisa ter a própria cara,
o que entra nela e os números que importam ali. Parte do Book ("A visão pessoal de cada empresa", módulo
Negócios) e leva a mesma ideia para as áreas da vida, sem virar ERP, CRM ou sistema da empresa: continua sendo
só o que depende da pessoa.

- **Modelo por contexto:** ao criar ou editar um contexto, escolher o que ele é (empresa, trabalho, saúde,
  finanças, casa, família, estudos…). O modelo define os números do topo, as seções, os atalhos de criação e o
  primeiro passo. Exemplos:
  - Empresa (Iter Mídia, Quintal Escola, Iter Gestão Contábil): abertas, atrasadas, aguardando, próxima reunião;
    abas Responsabilidades, Projetos, Decisões, Compromissos; atalhos Nova decisão e Cobrar retorno.
  - Saúde: próxima consulta, exames pendentes, rotina da semana (com Rotinas); atalhos Nova consulta e Exame.
  - Finanças: contas que vencem no mês, Rotas financeiras e quanto já foi guardado; atalhos Conta a pagar e
    Nova reserva.
  - Casa: contas, consertos e compras; atalhos por tipo.
- **O que entra em cada contexto, configurável:** ligar e desligar seções, criar frentes internas (ex.: na Iter
  Mídia, Clientes, Equipe, Comercial, Financeiro) que agrupam o que depende da pessoa, cobrança padrão e cor.
- **Dados:** modelo e configurações no contexto (nova migração) e frentes como agrupamento leve.

## Fase 7 · Rotinas e hábitos (em revisão com o Daniel)

Recorrências e hábitos com horário (Book 6.3). Uma rotina aparece no Hoje quando é a hora dela e some quando
não é. Frequência realista ("4 vezes por semana"), acompanhamento da semana sem culpa, sem sequência que zera.

- **Dados (migração 0007):** `routines` (dias fixos ou N vezes por semana, horário, duração, contexto, pausada) e
  `routine_checks` (um registro por dia feito). Não existe contagem de sequência.
- **Regra:** dias fixos aparecem no Hoje nos dias deles; "N vezes por semana" aparece todo dia até a semana chegar
  na meta. Rotina com dia e horário vira bloco no calendário. Dias que já passaram podem ser marcados depois.
- **Telas:** `/rotinas` (criar, a semana em pontos, "3 de 4", ajustar e pausar); seção Rotinas no Hoje; grupo na
  lateral com "3/4"; Busca. As respostas das perguntas do começo (Academia, Leitura…) vêm preenchidas.

## Fase 8 · Notas

Notas vinculadas a uma empresa, projeto, matéria ou responsabilidade (Book 6.4). Decisões registradas com o
que foi decidido, por quê e quando.

## Depois

Notificações (fecham a fase 2), Connect com o Vértice, IA/MCP.
