# Rumo · Brand & Product Book v1.0

Documento oficial do Rumo, em HTML interativo. Evolui o Brand Book v1.1: continua sendo a referência da marca
e passa a registrar a estratégia oficial do produto. Referência canônica para design, desenvolvimento, produto,
marketing, onboarding, lançamento e validação comercial.

Este documento não altera o aplicativo Rumo. Nenhuma tela, banco ou migration do produto foi tocada.

## Como abrir

1. Descompacte a pasta `rumo-brand-book`.
2. Dê dois cliques em `index.html`. Abre em qualquer navegador atual (Chrome, Edge, Safari, Firefox), sem internet e sem instalar nada.
3. Navegue pelos capítulos no índice à esquerda, pelas abas e sub-abas de cada capítulo ou pela busca (Ctrl+K ou ⌘K). As setas ← e → avançam seção por seção.
4. Para gerar um PDF, use Imprimir → Salvar como PDF no navegador (A4 paisagem, um capítulo por página).

Os links externos (fontes de pesquisa no capítulo 12) são os únicos que precisam de internet.

## Capítulos

| | Capítulo | Conteúdo |
|---|---|---|
| 01 | Marca | Quem é o Rumo, plataforma da marca, posicionamento, personalidade, voz |
| 02 | Estratégia | O problema, o que o Rumo entrega, movimentos (com Direcionar), diferenciação, o que não somos, regra de produto |
| 03 | Público | ICP inicial, produto horizontal e entrada vertical, personas (interativo), sequência de entrada |
| 04 | Produto | Core universal, Hoje, Responsabilidades e follow-up, Inbox e captura, Calendário |
| 05 | Arquitetura | Core + Módulos, visualizador de módulos (interativo), princípios |
| 06 | Módulos | Negócios, Estudos, Rotinas & Hábitos, Notas, Rotas |
| 07 | Rotas | Conceito, simulador (interativo), exemplos, tela, linguagem |
| 08 | Connect | Rumo Connect, fluxo, regras, IA e MCP (visão futura) |
| 09 | Experiência | Onboarding adaptativo (interativo), um Rumo para cada vida, simplicidade |
| 10 | Identidade Visual | Logo, cor, tipografia, forma, iconografia, linguagem gráfica, movimento, território |
| 11 | Interface | Direção visual, telas conceituais (claro/escuro, desktop/mobile), componentes, acessibilidade, peças de marca |
| 12 | Mercado & Validação | Leitura, o que precisamos provar, métricas, mercado, benchmark PlenyOS, riscos, simulação, fontes |
| 13 | Futuro | Visão de longo prazo, Direcionar, o que não muda |
| Anexo | Recursos | Como usar, arquivos, tokens, em validação, histórico |

O benchmark do PlenyOS (capítulo 12) está preparado e aguarda o arquivo de análise.

## Estrutura

```
rumo-brand-book/
├── index.html            Documento completo (13 capítulos e anexo)
├── README.md
├── tokens/
│   ├── tokens.css        Variáveis CSS: cor, tipo, espaço, raio, sombra, movimento
│   └── tokens.json       Mesmos tokens no formato W3C Design Tokens
└── assets/
    ├── css/              tokens · base · layout · chapters · components · product · book · print
    ├── js/               nav · copy · logo-lab · color · components · motion · viability · book
    ├── fonts/            Inter variável (woff2) + licença OFL
    ├── logo/             Assinaturas, símbolos, ícone de app e favicon (SVG e PNG)
    └── icons/            Subconjunto Lucide (sprite.svg) + licença ISC
```

## Logo

O logo oficial vem do pacote `rumo-brand-assets-v1` (README original em `assets/logo/README-pacote-v1.md`).
Símbolos e ícone de app são os arquivos originais. Nas assinaturas horizontais, o wordmark "Rumo"
foi convertido em contorno (Inter 600, 72 px, letter-spacing −2,4), para não depender da fonte instalada.
No Brand Book v1.1, o encaixe entre a haste e a perna foi corrigido (o topo da haste aparecia acima da perna) e as versões
de uma cor ganharam um respiro entre essas duas peças.

| Arquivo | Uso |
|---|---|
| `rumo-logo-horizontal.svg` | Assinatura principal, fundos claros (Warm, branco, Lavanda) |
| `rumo-logo-horizontal-light.svg` | Assinatura clara, fundos escuros (Deep, Charcoal) |
| `rumo-logo-horizontal-mono-dark.svg` / `-mono-light.svg` | Uma cor: Charcoal ou Warm |
| `rumo-symbol.svg` | Símbolo principal, com gradientes |
| `rumo-symbol-light.svg` | Símbolo claro, para fundos escuros |
| `rumo-symbol-mono-dark.svg` / `-mono-light.svg` | Símbolo em uma cor |
| `rumo-app-icon.svg` / `-1024.png` / `-180.png` | Ícone de aplicativo |
| `favicon.svg` / `favicon-16/32/64.png` | Favicon (ícone de app sem a margem externa) |

## Itens em validação

Marcados no documento como "Proposta v1": cor de texto secundário (#5F586B),
cores funcionais, escala de espaço, tokens de movimento, área de proteção e tamanhos mínimos.
A lista completa está no anexo Recursos › Em validação.

Brand & Product Book v1.0 · 21 de outubro de 2026
