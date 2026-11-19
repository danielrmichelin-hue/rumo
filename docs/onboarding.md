# As perguntas do começo (onboarding adaptativo)

Especificação pronta para construir. Base: Book, capítulo 09 (Experiência) e capítulo 05 (Arquitetura).
Referência visual: `docs/telas/onboarding-perguntas.png`, adaptada à direção visual aprovada no CLAUDE.md.

## Para que serve

Na primeira vez que a pessoa entra, o Rumo pergunta **o que ela quer organizar**, não quais módulos ela
quer. A partir das respostas ele:

1. **liga os módulos** que as respostas pedem;
2. **monta a barra lateral** (ela nasce pronta, com os contextos da pessoa);
3. **cria os contextos e projetos** que ela citou (Iter Mídia, Casa, Reforma…);
4. **prepara os estados vazios** de cada área com o primeiro passo;
5. **entrega um primeiro Hoje que já faz sentido**.

Leva menos de 1 minuto. Tudo pode ser mudado depois.

## Quando aparece

- Logo depois de criar a conta, e em todo acesso enquanto a pessoa não terminar.
- Rota: `/comecar`. O layout do app redireciona para lá quando o perfil não tem `onboarded_at`.
- Pode ser refeito em Ajustes → "O que você organiza", com as respostas atuais já marcadas.

## Passo 1 · Nome

- Título: **Como você quer ser chamado?**
- Um campo, preenchido com a parte do e-mail antes do @ se não houver nome.
- Botão: **Continuar**.
- Uso: a saudação do Hoje ("Boa tarde, Daniel").

## Passo 2 · O que organizar

- Título: **O que você quer organizar com o Rumo?**
- Subtítulo: **Escolha quantos quiser. O Rumo monta a sua navegação a partir disso, e você pode mudar depois.**
- Sete opções em cartões de seleção múltipla, com ícone `lucide-react`:

| Chave | Rótulo | Ícone |
| --- | --- | --- |
| `vida` | Vida pessoal | `HeartPulse` |
| `estudos` | Estudos | `GraduationCap` |
| `rotinas` | Rotinas e hábitos | `Repeat` |
| `objetivos` | Objetivos e metas | `Route` |
| `projetos` | Projetos pessoais | `Folder` |
| `trabalho` | Trabalho | `Briefcase` |
| `negocios` | Meus negócios | `Building2` |

Ordem atualizada em 20/11/2026: vida pessoal, estudos e metas primeiro, pelo público inicial (`docs/publico.md`).

- No computador, ao lado, uma prévia **"Sua navegação"** que se monta ao vivo conforme a pessoa marca:
  Core sempre (Hoje, Inbox, Calendário, Responsabilidades, Projetos) e, abaixo, os grupos que as respostas
  criam. No celular, a prévia fica abaixo das opções, recolhida.
- Pode seguir sem marcar nada: fica só o Core. Texto nesse caso: **Só o Core. Hoje, Inbox, Calendário,
  Responsabilidades e Projetos. Módulos podem ser ativados depois.**

## Passo 3 · Uma pergunta para cada escolha

Uma tela (ou um bloco) por opção marcada, na ordem da tabela abaixo. Cada pergunta tem sugestões em
etiquetas clicáveis e um campo "+ Adicionar" para escrever outra. Botões: **Continuar** e **Pular**.

| Opção | Pergunta | Sugestões | O que o Rumo faz com a resposta |
| --- | --- | --- | --- |
| Trabalho | De onde chegam as suas demandas de trabalho? | E-mail · WhatsApp · Sistemas da empresa · Reuniões | Cria o contexto **Trabalho** (tipo área). Guarda as origens (servirão ao Connect) |
| Vida pessoal | Quais áreas da vida pessoal você quer organizar? | Casa · Saúde · Finanças · Família | Cria um contexto (tipo área) para cada uma |
| Projetos pessoais | Algum projeto pessoal em andamento? | Reforma · Viagem · Mudança · Casamento | Cria um projeto ativo para cada um |
| Meus negócios | Quais empresas você quer acompanhar? | Sem sugestão fixa: campo para digitar os nomes (ex.: Iter Mídia, Rumo) | Cria um contexto **tipo empresa** para cada uma. Liga o módulo Negócios |
| Estudos | O que você estuda agora? | Graduação · Pós · Idiomas · Concurso · Curso livre | Liga Estudos; a resposta sugere o tipo do primeiro ciclo de estudos |
| Rotinas e hábitos | Alguma rotina que você já tenta manter? | Academia · Leitura · Meditação · Revisar a semana | Liga Rotinas; a primeira resposta vem preenchida como a primeira rotina |
| Objetivos e metas | Qual é o primeiro destino? | Guardar dinheiro · Terminar um livro · Concluir um curso · Abrir um negócio | Liga Rotas; a resposta sugere o tipo da primeira Rota |

Cada contexto criado recebe uma cor da paleta de contextos, sem repetir.

## Passo 4 · Pronto

- Título: **Seu Rumo está pronto.**
- Resumo curto do que foi montado, em linha: "3 contextos, 1 projeto. Estudos e Rotas chegam em breve."
  (a segunda frase só aparece se a pessoa escolheu um módulo que ainda não existe).
- Botão: **Ir para o Hoje**.

## Como a barra lateral fica depois

```
Buscar ⌘K
Hoje · Inbox · Calendário · Responsabilidades · Projetos     ← Core, sempre
Negócios      Iter Mídia · Rumo                             ← contextos tipo empresa
Áreas         Trabalho · Casa · Saúde                       ← contextos tipo área
Estudos       …                                             ← só quando o módulo existir
Rotinas       …                                             ← só quando o módulo existir
Rotas         …                                             ← só quando o módulo existir
```

Grupo sem itens não aparece. Módulo ligado que ainda não existe não aparece (sem menu vazio nem "em
breve" na lateral).

## Estados vazios do primeiro dia

Cada área criada mostra o primeiro passo, no tom do Book:

| Área | Texto |
| --- | --- |
| Empresa (ex.: Iter Mídia) | Comece pelo que depende de você: uma decisão, um retorno, uma reunião. |
| Trabalho | Capture a primeira demanda. Ela entra na Inbox e você decide depois onde fica. |
| Casa | Contas, consertos, compras: o que depende de você em casa. |
| Projeto pessoal | Um projeto tem começo e fim. Comece pelo próximo passo dele. |
| Hoje vazio | Nada pendente nesta etapa. Capture o que estiver na cabeça. |

## Dados

Nova migração numerada (ex.: `0004_perfil.sql`), sem editar as anteriores:

```sql
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  modules text[] not null default '{}',     -- negocios, estudos, rotinas, notas, rotas
  onboarding jsonb not null default '{}',   -- escolhas e respostas do começo
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS "dono lê/cria/altera/apaga", como nas outras tabelas, e o gatilho de updated_at.
```

Exemplo de `onboarding`:

```json
{
  "escolhas": ["negocios", "vida", "objetivos"],
  "trabalho_origens": [],
  "estudos": [],
  "rotinas": [],
  "objetivo": "Guardar dinheiro"
}
```

Mapeamento escolha → módulo: `negocios` → `negocios`; `estudos` → `estudos`; `rotinas` → `rotinas`;
`objetivos` → `rotas`. `trabalho`, `vida` e `projetos` não ligam módulo: viram contextos e projetos do Core.

## No código

- `src/lib/modulos.ts`: a lista de módulos (chave, nome, ícone, grupo na lateral, `disponivel`). No MVP só
  `negocios` está disponível.
- A barra lateral se monta pelo perfil + essa lista + os contextos (separados por tipo), não por links
  fixos.
- `src/app/comecar/`: as telas do onboarding, fora da casca do app (sem barra lateral), com o logo oficial.
- Gravar tudo no fim, numa ação só: perfil, contextos e projetos. Se falhar, nada fica pela metade.

## Pronto quando

- Conta nova cai em `/comecar`; conta que já terminou nunca mais vê, a não ser por Ajustes.
- Marcar "Meus negócios" e digitar "Iter Mídia" e "Rumo" cria dois contextos tipo empresa, que aparecem
  no grupo Negócios da lateral.
- Marcar "Vida pessoal" com Casa e Saúde cria os dois contextos no grupo Áreas.
- Escolher Estudos não cria menu nenhum, mas fica salvo em `profiles.modules`.
- Pular tudo leva a um Rumo só com o Core, sem erro.
- Refazer em Ajustes não duplica contextos que já existem (compara pelo nome).
- Textos exatamente como acima. Sem exclamação, sem emoji.
- `npm run build` sem erros e as telas abertas no navegador, no claro e no escuro, no celular e no
  computador.

## Decisões para confirmar com o Daniel

- Os contextos que ele já criou na Fase 1 continuam; o onboarding dele pode só confirmar o que existe.
- Se Estudos, Rotinas e Rotas devem mostrar algo antes de existirem (hoje: não mostram nada).
