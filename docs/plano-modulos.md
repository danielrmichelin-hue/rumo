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

## Fase 5 · Estudos

Matérias, ciclos, aulas, leituras, sessões e progresso (Book 6.2). Cada sessão vira um bloco no calendário e um
item no Hoje. Tela da matéria/curso com ciclo atual, semana planejada × feita, matérias com progresso,
próxima sessão e leituras. Uma Rota de estudos pode ficar ligada ao curso.

## Fase 6 · Rotinas e hábitos

Recorrências e hábitos com horário (Book 6.3). Uma rotina aparece no Hoje quando é a hora dela e some quando
não é. Frequência realista ("4 vezes por semana"), acompanhamento da semana sem culpa, sem sequência que zera.

## Fase 7 · Notas

Notas vinculadas a uma empresa, projeto, matéria ou responsabilidade (Book 6.4). Decisões registradas com o
que foi decidido, por quê e quando.

## Depois

Notificações (fecham a fase 2), Connect com o Vértice, IA/MCP.
