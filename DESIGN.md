---
name: CapyPay
description: Painel de finanças pessoais em preto e branco, feito de folhas que flutuam sobre uma mesa cinza.
colors:
  ink: "#101114"
  ink-secondary: "#5F646C"
  ink-tertiary: "#7E848D"
  desk: "#E9EBEE"
  sheet: "#FFFFFF"
  sheet-raised: "#FCFCFD"
  sunken: "#F1F2F4"
  hairline: "#E4E6EA"
  hairline-strong: "#D3D6DC"
  block: "#16171A"
  block-ink: "#FFFFFF"
  block-ink-secondary: "#9DA2AB"
  desk-night: "#080809"
  sheet-night: "#17181B"
  sheet-raised-night: "#1C1D21"
  sunken-night: "#212226"
  hairline-night: "#26282C"
  ink-night: "#F4F5F6"
  ink-secondary-night: "#9AA0A8"
  ink-tertiary-night: "#787E86"
  block-night: "#F4F5F6"
  block-ink-night: "#101114"
  block-ink-secondary-night: "#5F646C"
  series-1: "#101114"
  series-1-night: "#F4F5F6"
  income: "#008B6D"
  expense: "#B8492E"
  contribution: "#8072C2"
  income-night: "#00A88B"
  expense-night: "#DB684C"
  contribution-night: "#8F81D3"
  income-on-block: "#008B6D"
  expense-on-block: "#B8492E"
  contribution-on-block: "#8072C2"
typography:
  greeting:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  wordmark:
    fontFamily: "Figtree Variable, var(--font-sans)"
    fontSize: "1.1875rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  wordmark-sm:
    fontFamily: "Figtree Variable, var(--font-sans)"
    fontSize: "1.0625rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  figure:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.04em"
  figure-lg:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.04em"
  display-prose:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  display-prose-sm:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  ui:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0"
  micro:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.01em"
  numeric:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.02em"
    fontVariation: "tabular-nums"
rounded:
  xs: "6px"
  sm: "12px"
  md: "18px"
  lg: "24px"
  xl: "32px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "28px"
  2xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.block}"
    textColor: "{colors.block-ink}"
    rounded: "{rounded.pill}"
    padding: "12px 22px"
    typography: "{typography.ui}"
  button-primary-hover:
    backgroundColor: "#2A2C31"
  button-quiet:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "12px 18px"
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  block-panel:
    backgroundColor: "{colors.block}"
    textColor: "{colors.block-ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    typography: "{typography.ui}"
  sidebar:
    backgroundColor: "{colors.block}"
    textColor: "{colors.block-ink}"
    width: "232px"
  nav-item-active:
    backgroundColor: "{colors.sheet-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "48px"
  nav-item-rest:
    backgroundColor: "transparent"
    textColor: "{colors.block-ink-secondary}"
    height: "48px"
---

# Design System: CapyPay

## Overview

**Creative North Star: "Papel sobre Papel"**

A tela é uma mesa cinza-clara com folhas de papel encorpado apoiadas sobre ela. Cada painel é uma folha: cantos aparados generosos, superfície branca lisa, e uma sombra difusa e curta — a sombra que papel grosso realmente projeta, não o halo que um efeito produz. Sobre essas folhas há tinta preta e nada mais.

A ausência de cor é a decisão, não a economia. Sem matiz para carregar significado, todo o trabalho de hierarquia recai sobre coisas mais duráveis: tamanho, peso, densidade e a distância entre os elementos. É mais difícil de acertar e muito mais difícil de errar — não existe combinação de cores para envelhecer mal, e nenhum leitor perde informação por não distinguir um matiz de outro. Isso continua valendo para o sistema inteiro; o que mudou é que ele agora tem **três exceções nomeadas, fechadas, e nenhuma outra** — ver "As Três Exceções de Cor" em Colors.

O acento monocromático existe, e é o inverso: um **bloco de tinta cheia**, retângulo preto sólido com texto branco. É a mancha de tinta na folha. Ele carrega o cartão, o saldo poupado, o item de navegação ativo e o alerta de orçamento estourado — sempre no máximo dois ou três por tela, porque uma folha com metade da área impressa em preto deixa de ter hierarquia.

O sistema recusa duas coisas que a categoria costuma entregar: o gradiente colorido como sinal de modernidade, e o **semáforo** vermelho/verde. A identidade de fluxo é a cor real que a categoria pede — receita e despesa distinguíveis à primeira vista — mas verde-e-terracota, não verde-e-vermelho de painel de carro; validada contra as duas formas de daltonismo mais comuns, para não reproduzir o par que menos funciona para menos gente. E ela nunca é a única leitura: um limite estourado continua se anunciando invertendo o painel inteiro para tinta cheia, que num campo majoritariamente monocromático é o evento mais alto disponível — e continua sem cor, de propósito, porque um alerta não é uma categoria, é um estado.

**Key Characteristics:**

- Preto, branco e cinzas quase em todo lugar. Duas exceções fechadas — o retrato de avatar (livre, nunca padrão) e a identidade de receita/despesa/aporte (fixa, nunca escolhida) — e nenhuma outra
- Painéis como folhas: raio de 24px, sombra difusa e curta, borda de 1px quase invisível
- O inverso — bloco de tinta cheia — é o único acento monocromático, gasto no máximo três vezes por tela
- Números monoespaçados tabulares; a figura principal em sans, proporcional, muito grande
- Hierarquia por escala e espaço quase sempre; cor só nas três exceções, e nunca sozinha

## Colors

Uma escala neutra fria, do papel à tinta, sem nenhum desvio de matiz que possa ser lido como cor — mais duas rampas coloridas, cada uma presa a um só uso.

### As Três Exceções de Cor

O sistema tem exatamente três cores fora da escala neutra. Nenhuma outra existe, e nenhuma nova entra sem virar uma quarta regra nomeada aqui.

| | Retrato de avatar | Identidade de fluxo | Ilustração de login |
|---|---|---|---|
| **Quem escolhe** | Quem usa o app, entre dez opções, em tempo real | O sistema — nunca uma escolha | Quem mantém o produto, uma vez, no código — quem usa o app não escolhe nem troca |
| **Onde aparece** | Só no avatar | Ícone de direção, marca de gráfico, a Figura quando é um resultado, e o anel/barra de progresso de Orçamento e Metas quando marcam status dentro do limite ou estourado | Só no painel esquerdo de `LoginPage` — nunca dentro do `AppShell`/`AdminShell`, onde o sistema monocromático vale sem exceção |
| **Por quê** | É a única coisa na tela que representa uma pessoa, não um dado | Receita e despesa são a distinção mais lida da tela; a forma sozinha (seta, sinal, peso) já bastava, a cor é reforço, não requisito | Quem ainda não entrou não está lendo um dado financeiro — a tela de login não tem número nenhum para a cor competir com ele |

A diferença entre as três é a diferença entre personalização, informação e primeira impressão. As duas primeiras são internas ao produto autenticado; a terceira vive inteiramente fora dele, na única tela que existe antes de qualquer sessão. Fora dessas três, a resposta para "posso colorir isto" é sempre não.

**A Regra da Marca que Se Move.** O mascote do logotipo ganha vida no tour de boas-vindas (`features/onboarding/Capivara.tsx`): o mesmo desenho, redesenhado em SVG, em traço de espessura única e `currentColor` — tinta sobre papel como todo o resto, sem abrir exceção de cor nenhuma. Ele não ganha membro que o logotipo não tem: acenar é inclinar a cabeça, comemorar é a pilha de moedas saltando e o brilho estourando. Uma mascote que ganha partes novas para cada gesto deixa de ser a marca e vira um desenho parecido com ela. E ele não sai do tour: no painel de todo dia, uma mascote respirando cansa na terceira manhã. A licença para o movimento contínuo é a mesma da Regra da Cena Que Acontece Uma Vez.

### Identidade de fluxo

Três matizes fixos — receita, despesa, aporte — nunca escolhidos, nunca reordenados, nunca aplicados a uma quarta categoria. Verde e terracota, não verde e vermelho: um par pensado para não coincidir com a confusão vermelho-verde que afeta a maioria dos daltonismos, com um terceiro matiz (violeta) longe o bastante dos dois para não ser confundido com nenhum.

- **Receita** (`{colors.income}` / `{colors.income-night}`) — `#008B6D` / `#00A88B`
- **Despesa** (`{colors.expense}` / `{colors.expense-night}`) — `#B8492E` / `#DB684C`
- **Aporte** (`{colors.contribution}` / `{colors.contribution-night}`) — `#8072C2` / `#8F81D3`

Mais uma variante — `--income-on-block` / `--expense-on-block` / `--contribution-on-block`, `#008B6D` / `#B8492E` / `#8072C2` nos dois temas — para quando a marca pousa sobre o bloco de tinta, e não sobre Folha ou Rebaixado. Ver "A Regra da Cor que Se Adapta à Superfície" mais abaixo.

Validados como paleta categórica contra `--sheet` e `--sunken`, nos dois temas, com todos os pares em jogo (não só os adjacentes): separação por daltonismo ΔE ≥ 8.6, piso de visão normal ΔE ≥ 16.4, contraste ≥ 3:1. Esse último número é a régua de tudo que vem a seguir — 3:1 é contraste de **ícone e marca gráfica**, não de texto (que pede 4.5:1). Por isso a cor nunca veste o algarismo pequeno de uma lista ou de um resumo: vive na seta de direção — sempre a mesma seta, sempre no mesmo lugar visual — e na Figura, grande o bastante (44–56px) para contar como texto grande e liberar o critério de 3:1. A marca nunca é uma forma nova, criada só para carregar cor: é a seta que a lista de lançamentos já usa, reaproveitada como rótulo de resumo, como item de legenda e como marca de tooltip — um vocabulário só, não um por lugar. Em qualquer lugar onde a cor aparece, a informação que ela carrega já estava dita de outro jeito: seta, sinal, posição. Tirar a cor não tira leitura nenhuma — ver "A Regra das Quatro Leituras", que continua de pé sem a quarta.

### Primary

- **Tinta** (`{colors.ink}` / `{colors.ink-night}`): todo texto primário, todo ícone ativo, o preenchimento do bloco e da ação principal. É a "cor" neutra do sistema.
- **Bloco** (`{colors.block}` / `{colors.block-night}`): o retângulo de tinta cheia. **No tema escuro ele inverte para claro** — o papel escurece, e a mancha que antes era preta passa a ser branca, preservando o mesmo papel de contraste máximo.

### Neutral

- **Mesa** (`{colors.desk}` / `{colors.desk-night}`): o fundo da página, sempre mais escuro que a folha, para que a folha pareça apoiada.
- **Folha** (`{colors.sheet}` / `{colors.sheet-night}`): os painéis.
- **Folha Erguida** (`{colors.sheet-raised}` / `{colors.sheet-raised-night}`): a moldura que contém o aplicativo em telas largas.
- **Rebaixado** (`{colors.sunken}` / `{colors.sunken-night}`): campos, trilhos de barra e cabeçalhos de tabela — tudo que é receptáculo em vez de conteúdo.
- **Hairline** (`{colors.hairline}` / `{colors.hairline-night}`): divisores. Sempre 1px, e usado com parcimônia: o espaço separa melhor que a linha.
- **Tinta Secundária** (`{colors.ink-secondary}`): rótulos, metadados e todo texto de apoio. Aferida acima de 4.9:1 contra qualquer superfície do sistema.
- **Tinta Terciária** (`{colors.ink-tertiary}`): **ícone em repouso, nunca texto**. A exigência dela é a de componente de interface (3:1) e não a de texto (4.5:1) — aferida em 3.36:1 contra a superfície rebaixada, a pior em que aparece. Usá-la em texto é o erro que o token convida e que a revisão precisa pegar.

### Named Rules

**A Regra da Tinta Escassa.** A barra lateral é o maior bloco de tinta do sistema e já consome boa parte da cota. Com ela em cena, sobram **no máximo dois** outros blocos por tela — no painel, o cartão e mais nada. Passando disso, a tela pende para o lado escuro e o bloco deixa de significar "isto importa".

**A Regra do Sinal Sem Cor.** Nenhuma informação depende **só** de matiz — a identidade de fluxo é sempre a última das leituras, nunca a única. Apague a cor de qualquer tela (impressão em preto e branco, modo de alto contraste, um daltonismo que o par não cobriu) e nada se perde: é o mesmo desenho, com um reforço a menos.

**A Regra das Quatro Leituras.** Entrada e saída se distinguem de **quatro formas ao mesmo tempo**, e só a última depende de matiz: a seta antes do valor (sobe para receita, desce para despesa, segue para o lado no aporte), o sinal `+`/`−`, o peso da tinta, e a cor do ícone de direção. A seta é o recurso que extrato de banco usa há décadas e fazia sozinha o trabalho que a cor faz agora também; as três primeiras já bastavam sem a quarta, o que é exatamente por que a quarta pôde entrar — reforçar uma leitura que já sobrevivia ao papel e a qualquer daltonismo, e não substituí-la. Estado de orçamento e de meta segue a mesma contenção nas leituras que não são cor — preenchimento, ícone e rótulo textual seguem carregando a informação sozinhos — mas agora soma a cor como reforço final, pela mesma lógica: ver "A Regra do Status Emprestado".

**A Regra do Alerta Invertido.** Um limite estourado inverte o painel para tinta cheia. Num campo monocromático, inverter é o evento mais alto disponível, e é por isso que ele fica reservado a uma condição só.

**A Regra do Status Emprestado.** O anel (`Donut`) e a barra (`Progress`) de Orçamento e Metas podem vestir a prop `tone`, que aplica a mesma Receita/Despesa já validada — nunca uma terceira cor de "alerta" ou "aviso". É empréstimo, não uma nova exceção: a paleta continua fechada em duas rampas. A leitura é binária, não a três vias que `BudgetStatus.state` permitiria — dentro do limite usa Receita, estourado usa Despesa; não existe um meio-termo colorido para o estado `warning`, porque uma terceira cor no mesmo par é o primeiro passo para o "painel colorido genérico" que este sistema evita. Meta nunca tem estado negativo, então usa Receita sempre. Como em toda aplicação da identidade de fluxo, a cor nunca é a única leitura: o valor exato, o rótulo e — no estouro — a faixa hachurada e o `BlockPanel` de "Atenção" já contam a mesma história sem ela.

### Séries de gráfico

Dois regimes, um por gráfico, nunca misturados.

**Resultado anual — uma curva, sem cor.** Um matiz só, em Tinta: `{colors.series-1}` / `{colors.series-1-night}`. Ela não é uma das três categorias de fluxo — é o resultado do mês, que já é decodificado por posição (acima ou abaixo do zero) e pela forma da própria curva. Uma série não precisa de identidade nenhuma para se identificar; ela é a única coisa no gráfico.

**Entrou, saiu e guardou — três categorias, com identidade.** Receita, despesa e aporte vestem a **identidade de fluxo** (ver Colors) em vez de uma rampa de luminosidade: a mesma cor da coluna aparece no ícone de direção da lista de lançamentos e no resumo do período, então o gráfico deixou de ser o único lugar sem essa pista. Como a identidade é o único canal de cor que sobra, **a legenda é obrigatória** e o gráfico nunca passa de três séries — a quarta não teria matiz fixo e validado para vestir, e improvisar um quebraria a regra de que cor de fluxo nunca é escolhida.

**Rampa ordinal (`{colors.ramp-1}` a `{colors.ramp-4}`).** Quatro degraus de um matiz só — `#101114`, `#3A3F47`, `#6B727C`, `#A2AAB5` no claro; `#F4F5F6`, `#C3C8CF`, `#8B929C`, `#5A616B` no escuro. Existe para **parte-do-todo sem cor**, e hoje só o disco de atividade de contas do painel de administração a usa. Não é paleta categórica e não pode virar uma: os degraus não têm identidade, só posição, e por isso um matiz basta. Aprovada no validador contra `--sheet` nos dois temas — luminosidade monótona, salto adjacente ≥ 0.06, ponta clara em 2.35:1 (claro) e 2.84:1 (escuro), dispersão de matiz de 15° e 9°, dentro do limite de 40° que separa "uma rampa" de "cores diferentes". A rampa acompanha a **ordem** das faixas, nunca o tamanho delas: tingir a maior fatia de mais escuro codificaria pela segunda vez o que o ângulo já diz.

**A Regra da Marca que Não Muda de Forma.** A marca de categoria é sempre a seta de direção — nunca uma forma inventada para um lugar específico. Legenda, tooltip e resumo mostram a mesma seta que a lista de lançamentos já usa; o que muda entre eles é só a cor, e só quando a superfície exige.

**A Regra da Cor que Se Adapta à Superfície.** A identidade de fluxo é validada contra Folha e Rebaixado — as superfícies onde a maior parte da tela vive — não contra o bloco de tinta, que é o inverso do tema. No balão do gráfico, que é bloco, a cor comum de Receita no tema escuro cai para 2,76:1 contra o bloco claro — abaixo do piso de 3:1. A correção não é um contorno: é uma segunda variante da mesma identidade (`--income-on-block` e as duas irmãs), calibrada e validada contra os dois blocos, e usada só onde a marca pousa sobre tinta cheia. Fora do balão, a variante comum já basta. Esta regra sucede uma versão anterior que resolvia o mesmo problema com um anel de contorno em vez de recalibrar a cor — o anel escondia o sintoma; a variante corrige a causa.

## Typography

**Body Font:** Geist Variable (com `ui-sans-serif, system-ui, sans-serif`)
**Numeric Font:** Geist Mono Variable (com `ui-monospace, monospace`)
**Wordmark Font:** Figtree Variable, peso 800 — **exclusiva do logotipo**

**Character:** Uma família de trabalho neutra, sem maneirismo, porque num sistema sem cor a tipografia carrega quase toda a expressão e não pode ficar chamando atenção para si. O companheiro monoespaçado não é traje técnico: valor monetário é medida, e medida em coluna alinha por casa decimal.

### Hierarchy

- **Logotipo** (Figtree, 800, 1.0625–1.1875rem, -0.035em): a palavra "CapyPay" ao lado da capivara. É a **única** exceção à regra de uma família só, e não sai daqui — nenhum outro texto do produto usa esta face. A interface inteira é uma face de trabalho escolhida para desaparecer; um logotipo tem o trabalho oposto, que é ser reconhecido. O nome vai em um peso só: diferenciar "Capy" de "Pay" por peso parece esperto no primeiro dia e vira ruído no centésimo.
- **Figura** (Figtree, 800, 2.75rem → 3.5rem, 1.0, -0.04em, **algarismos proporcionais**): o número que a tela existe para mostrar veste a face da marca, e não a de interface. É a segunda e última aparição do Figtree — dar ao número principal o desenho do logotipo amarra o painel à identidade sem repetir a marca em lugar nenhum.: o número que a tela existe para mostrar. Um por painel, no máximo dois por tela. É o único número fora da face tabular — nesse corpo, a largura fixa abre buracos entre os algarismos.
- **Display prosa** (600, 1.75rem → 2.125rem, 1.15): a frase de abertura da tela de boas-vindas.
- **Headline** (600, 1.375rem, 1.25): título de rota.
- **Title** (600, 1rem, 1.35): cabeçalho de folha.
- **Body** (400, 0.875rem, 1.6): prosa, limitada a 68ch.
- **UI** (500, 0.8125rem, 1.45): o tamanho mais frequente — linha de lista, valor de campo, botão.
- **Label** (500, 0.75rem, 1.35): rótulos e metadados. Caixa normal, nunca versalete espaçada.
- **Micro** (500, 0.625rem, 1.2): apenas o rótulo sob o ícone na barra inferior do celular.
- **Numeric** (500, Geist Mono, `tabular-nums`, -0.02em): todo valor em coluna.

### Named Rules

**A Regra da Coluna que Alinha.** Todo valor monetário em coluna ou lista usa a face monoespaçada com `tabular-nums`, alinhado à direita. A exceção é a Figura, que não tem coluna com que alinhar.

**A Regra da Figura Solitária.** Uma figura por painel. Dois números gigantes lado a lado anulam um ao outro e devolvem a tela ao problema que a hierarquia deveria resolver.

## Layout

Em telas a partir de 1280px o aplicativo vive dentro de uma **moldura**: um retângulo de 32px de raio em Folha Erguida, com respiro de 20px contra a Mesa em volta. É o que faz o conjunto parecer um objeto apoiado, e não uma página que sangra até a borda do monitor. Abaixo desse ponto a moldura é dispensada e o conteúdo usa a largura toda — em tela estreita, uma borda decorativa custa espaço que o conteúdo precisa.

Barra lateral expandida de 232px à esquerda, ocupando a altura inteira da moldura e arredondada à esquerda junto com ela. Abaixo de 1024px vira barra inferior fixa de cinco destinos; abaixo de 640px a tabela de transações se converte em lista.

**A Regra da Moldura que Não Rola.** A partir de 1024px — onde a barra lateral passa a existir — a moldura tem altura fixa e não acompanha a rolagem da página: quem rola é só o conteúdo, por dentro de si mesmo. Barra lateral e cabeçalho ficam sempre visíveis, na mesma posição, com a mesma margem contra a Mesa no topo e no fim — nunca só no topo. Isto não pede nenhum posicionamento especial: a barra é só mais um elemento de altura cheia dentro de uma caixa que também tem altura cheia. Abaixo de 1024px a moldura já não existe, e a página volta a rolar inteira, como qualquer página.

Conter a moldura em `overflow: hidden` não bastou sozinho: o `<html>` continuava relatando um `scrollHeight` do tamanho do conteúdo sem recorte — a altura que a página teria se nada tivesse `overflow: hidden` — mesmo com `<body>` e a moldura corretamente contidos e medindo certo. É um comportamento do próprio elemento raiz, que no Chromium não se limita à caixa medida de `<body>`. A página continuava rolável, e rolar levava a uma Mesa vazia, sem moldura, muito depois de barra e cabeçalho já terem saído de vista. A correção trava `overflow: hidden` em `html` e `body` diretamente, a partir de 1024px — a única superfície que o CSSOM trata como fonte de verdade para a rolagem do documento, e por isso o único lugar onde travar realmente fecha a rota de vazamento.

Grade de 12 colunas, `gap` de 20px, largura máxima de 1440px. Ritmo vertical em múltiplos de 4px, com 28px acima de um título e 14px abaixo dele.

Densidade: linha de tabela com 56px no desktop e 64px no celular. Preenchimento interno da folha, 24px; do bloco de tinta, 24px.

**A Regra da Coluna que Fecha.** Colunas lado a lado terminam na mesma linha. Elas quase nunca têm a mesma altura natural, e a diferença aparece como um rasgo de mesa no meio da tela — que lê como falha de carregamento, não como respiro. A coluna se estica até a altura da linha e o **último** painel dela cresce para preencher, distribuindo a sobra entre suas próprias linhas. Nunca se fecha o vão esticando o penúltimo, nem enchendo o fim da coluna com conteúdo que não foi pedido.

**A Regra da Faixa Única.** Título e controles de rota dividem uma faixa: nome à esquerda, seletor de mês e ações à direita, quebrando em duas linhas só quando a largura obriga. Empilhados por padrão, os controles ganhavam uma faixa própria enquanto o lado direito do título ficava vazio — duas ausências pelo preço de uma.

## Elevation & Depth

Profundidade **física e discreta**: a folha se separa da mesa por uma sombra difusa e curta, não por contorno. A borda de 1px existe só para segurar o limite quando a sombra desaparece — em tema escuro, e em impressão.

### Shadow Vocabulary

- **Folha apoiada** (`box-shadow: 0 2px 4px rgba(16,17,20,0.03), 0 8px 24px -8px rgba(16,17,20,0.07)`): estado normal de todo painel. Duas camadas — o contato curto e a difusão longa — porque é assim que um objeto apoiado sombreia.
- **Moldura** (`box-shadow: 0 24px 64px -24px rgba(16,17,20,0.16)`): o contêiner do aplicativo.
- **Flutuante** (`box-shadow: 0 16px 40px -12px rgba(16,17,20,0.22)`): diálogo, menu e tooltip, que estão de fato acima.
- **Bloco de tinta** (`box-shadow: 0 12px 28px -12px rgba(16,17,20,0.45)`): o painel invertido projeta mais sombra, porque é mais pesado.

### Named Rules

**A Regra da Sombra com Contato.** Toda sombra tem deslocamento vertical positivo e desfoque maior que o deslocamento. Halo colorido de deslocamento zero e sombra dupla clara-e-escura (o efeito estampado do neumorfismo) estão fora: reduzem a nitidez da borda e envelhecem rápido.

**A Regra do Escuro sem Sombra.** No tema escuro a sombra não é lida. A profundidade passa integralmente para a diferença de luminosidade entre mesa, folha e folha erguida, e a hairline assume o limite.

## Shapes

Cantos aparados e generosos, herdados da referência: moldura em 32px, folhas e blocos em 24px, agrupamentos internos em 18px, campos e linhas em 12px, e raio total nos controles verdadeiramente pílula — botão, aba segmentada, badge, pílula de período.

O cartão de crédito é o único elemento com proporção fixa (1,586:1, a do cartão real) e raio de 18px.

Contorno é sempre 1px. Nenhuma borda lateral colorida em painel, alerta ou item de lista.

Barras de progresso: 8px de altura, raio total, trilho em Rebaixado, preenchimento em Tinta. Sem gradiente, nunca.

## Components

### Buttons

- **Shape:** pílula, altura de 44px no desktop e 42px no celular.
- **Primary:** Bloco com texto Folha. Hover clareia para `#2A2C31`; no tema escuro, escurece.
- **Quiet:** fundo Rebaixado com texto Tinta. É a ação secundária de mesmo peso funcional.
- **Ghost:** transparente com Tinta Secundária; ao passar o mouse, fundo Rebaixado.
- **Destructive:** texto Tinta sobre fundo Rebaixado, com ícone. A confirmação final usa Bloco — sem vermelho, a gravidade vem do peso.
- **Focus:** anel de 2px em Tinta com 2px de deslocamento, idêntico em todo controle.
- **Disabled:** opacidade 40%, cursor `not-allowed`, e sem resposta ao toque — um botão inerte que cede sob o dedo promete uma ação que não vai acontecer.
- **Press:** o botão recua para 97% (o de ícone, 90%) e volta. É a resposta que separa um botão de uma etiqueta clicável, e usa escala em vez de cor porque a cor já está ocupada pelo hover.
- **Hover:** além do fundo, o ícone principal sobe 1px. Movimento pequeno o bastante para não distrair e suficiente para insinuar a ação.

### Sheets (painéis)

- **Corner:** 24px. **Background:** Folha. **Border:** 1px Hairline. **Shadow:** "Folha apoiada". **Padding:** 24px.
- Nunca folha dentro de folha. Um agrupamento interno usa Rebaixado com raio de 18px.
- Cabeçalho separado do corpo por espaço, não por divisor.

### Bloco de tinta

O componente-assinatura. Retângulo em Tinta cheia com texto Folha, raio de 24px e sombra própria. Hospeda: o cartão, a figura de poupança, o item de navegação ativo, a pílula do período selecionado, o menu suspenso e o alerta de orçamento estourado. Texto secundário dentro dele usa `{colors.block-ink-secondary}`, medido acima de 4.5:1 contra a tinta.

### Inputs / Fields

- Fundo Rebaixado, sem contorno em repouso, raio de 12px, altura de 44px. Rótulo em Label acima, a 6px.
- **Focus:** fundo passa a Folha, contorno 1px Hairline Forte, anel de foco.
- **Error:** contorno 1px em Tinta, ícone de alerta e mensagem que nomeia o problema e a correção. Sem vermelho: o contorno mais escuro e o ícone bastam num campo monocromático.

### Navigation

Coluna de **232px, expandida, com ícone e rótulo** — não um rail de ícones. Rótulo visível é mais rápido de varrer que ícone que exige tradução, e a largura cabe porque a moldura já reserva a lateral.

- **Fundo:** Bloco de tinta, altura inteira da moldura, arredondado à esquerda para acompanhá-la. É o único elemento estrutural em tinta cheia.
- **Rest:** ícone e rótulo em `{colors.block-ink-secondary}`. **Hover:** fundo em tinta invertida a 10%.
- **Active — a aba que entra na página:** o item selecionado veste a **cor do plano de conteúdo**, é arredondado só à esquerda e encosta na borda direita da barra. O limite entre barra e conteúdo desaparece naquele trecho: o item não é um botão destacado, é a própria página avançando para dentro da navegação.
- **Cantos côncavos:** acima e abaixo da aba ativa, uma curva invertida de **26px** liga a aba ao corpo da barra. O raio é grande de propósito e igual ao da lateral arredondada da aba, de forma que as três curvas formem uma linha contínua. Em 16px a curva saía curta demais para ser lida como curva — virava um degrau, e a aba parecia ter duas orelhas em vez de nascer da barra. Construída com um quadrado na cor do conteúdo e um quarto de disco na cor da barra recortado por `border-radius` — sem máscara e sem SVG, então acompanha qualquer troca de token.
- **Mobile:** abaixo de 1024px a coluna some (232px seriam mais da metade da tela) e vira barra inferior; o ativo troca o preenchimento por ícone em Tinta com rótulo Micro visível.

### Named Rules

**A Regra da Aba Contínua.** O item ativo nunca é um retângulo flutuando dentro da barra. Ele assume a cor do conteúdo e toca a borda, e os dois cantos côncavos são obrigatórios — são eles que transformam colagem em continuidade.

**A Regra do Movimento que Responde.** O produto anima o que o usuário provoca — toque, hover, foco, troca de mês — e nunca a chegada da página. Quem abre este painel dez vezes por dia não quer assistir ao carregamento na décima. Por isso o único movimento não provocado é a subida de 160ms do menu suspenso, que existe para o painel não parecer defeito de renderização.

**A Regra da Cena Que Acontece Uma Vez.** O tour de boas-vindas (`features/onboarding/`) é a única superfície do sistema que se permite ser cinematográfica: entrada escalonada linha a linha, holofote viajando de um alvo ao outro em 560ms, desfoque de profundidade de campo no que está fora do foco, e um halo pulsando — o único movimento **contínuo** de todo o produto. A licença vem de ele rodar **uma vez por conta, na primeira entrada**, e nunca mais: a Regra do Movimento que Responde protege quem abre o painel todo dia, e ninguém abre o próprio primeiro acesso duas vezes. Qualquer movimento desta natureza fora do tour é violação, não precedente.

**A Regra da Figura que Corre.** A figura principal anima do valor anterior até o novo quando o mês muda, em 450ms com ease-out exponencial. É funcional e não decorativo: o painel troca de período sem trocar de tela, e um número que salta não avisa que mudou — vendo a figura correr, percebe-se a direção antes de ler o número. Não anima na primeira montagem, porque contar a partir do zero ao abrir seria espetáculo.

**A Regra da Aba que Viaja.** O fundo do item ativo é **um elemento só**, posicionado por medida, que desliza entre os destinos — não um estilo que acende num item e apaga em outro. Trocar de rota vira deslocamento contínuo, e o olho acompanha para onde a seleção foi em vez de reprocurá-la. Animado por `transform` (nunca `top`), em 420ms com ease-out exponencial `cubic-bezier(0.16, 1, 0.3, 1)`: sai rápido e assenta devagar, que é como matéria se move. É o único movimento orquestrado do produto — o resto são transições de estado de 150 a 300ms.

### Barra de topo

Quatro campos, na ordem em que se usam: **avisos** (o que exige atenção), **tema** e **privacidade** (como a tela se apresenta) e **perfil** (quem é você). O perfil vem por último, separado por um divisor de 1px, porque é o único que não altera a tela — abre um menu de conta.

- **Distintivo de avisos:** muda de preenchimento, não de cor. Cheio em tinta quando existe algo urgente, contornado quando é só informação. Não há estado de "lido" — o aviso some quando a condição que o gerou deixa de valer.
- **Alternador de tema:** binário, sol ou lua, e nada mais. O ícone mostra o tema **que está na tela**, não a preferência salva — que pode ser "automático" e não tem desenho próprio. Um terceiro ícone de monitor obrigava a decifrar o símbolo para descobrir em que modo se estava. "Automático" segue existindo como escolha nomeada em Ajustes, e é o padrão de quem abre pela primeira vez; o primeiro toque aqui o converte em preferência explícita.
- **Avatar:** um de dez retratos ilustrados de capivara — artes prontas, embutidas no aplicativo, não um upload — em dois formatos (círculo, quadrado arredondado).

**A Regra do Retrato Livre.** O avatar é uma das três exceções de cor do sistema (ver "As Três Exceções de Cor" em Colors), e a única das três que quem usa o app escolhe em tempo real — a identidade de fluxo é fixa, e a ilustração de login é fixada no código. Ela fica contida aqui porque um retrato é a única coisa na tela que representa uma pessoa, e não um dado: o produto continua sem pedir nem guardar foto de ninguém. As dez ilustrações vivem na mesma grade, uma só escolha por vez, e o formato (círculo ou quadrado) é a única outra propriedade do avatar.
- **Saudação:** ocupa o **título** do painel, em 1.75rem — é a primeira linha que a pessoa lê no dia, e um rótulo miúdo acima do cabeçalho não sustentava esse papel. Segue o relógio de quem lê (bom dia até meio-dia, boa tarde até as dezoito, boa noite depois) e é recalculada a cada minuto, porque um painel financeiro fica horas aberto numa aba esquecida. Desligada, o painel volta a se chamar "Painel" — o cabeçalho nunca fica sem nome.

**A Regra da Abertura que Informa.** A saudação abre em bloco de três peças: a **folha de calendário** à esquerda em 52px (dia da semana abreviado sobre o número do dia, em Rebaixado — papel sobre papel, porque a cota de tinta da tela já está gasta na barra lateral e no cartão), o cumprimento, e embaixo o que hoje cobra — "1 lançamento vence hoje", ou "Nada vence hoje". A contagem sai do mesmo histórico que alimenta "Ainda vence este mês": lançamentos que já existem, sem previsão nem estimativa, e receita não entra porque receita não vence.

**A Regra do Elemento que Não se Repete.** Nada abre espaço no cabeçalho para dizer o que a tela já diz em outro lugar. O avatar ocupou essa folha e saiu: ele vive na barra de topo, a três centímetros dali, e a mesma marca duas vezes na mesma tela não acrescenta identificação nenhuma — só ocupa. A data ficou porque não aparece em nenhum outro canto do painel e é o único dado da tela que muda todo dia; o resto é sempre a mesma estrutura.

**A Regra da Opção que se Mostra.** Escolha de aparência é apresentada renderizada, nunca descrita. As dez ilustrações aparecem como miniaturas de verdade — nunca uma lista de nomes ou números para ler e adivinhar.

**A Regra dos Dois Nomes.** O nome completo vai impresso no cartão; o apelido é usado só na saudação. Ninguém quer ser cumprimentado pelo nome que está no documento, e forçar um campo só a servir os dois papéis obriga a escolher qual deles fica errado.
- **Menu suspenso:** fecha ao clicar fora, ao teclar Esc (devolvendo o foco ao gatilho) e ao navegar. Entra com 160ms de subida curta — um painel que simplesmente aparece parece falha de renderização.

**A Regra do Aviso Derivado.** Nenhum aviso é agendado ou inventado: todos são leitura do que já está salvo. Um painel financeiro que mostra notificação fabricada ensina o usuário a ignorar o sino, e aí o aviso que importava passa junto.

### A Marca

Uma capivara com uma pilha de moedas, em traço de espessura única. Entra como **máscara CSS**, nunca como `<img>`: a arte é monocromática e a barra lateral inverte de tinta para papel entre os temas, então uma imagem comum ficaria invisível em metade dos casos. Como máscara ela pinta com `currentColor` e acompanha o contexto sozinha.

O arquivo de origem é traço branco sobre um degradê cinza opaco; a conversão está em `tools/build-logo.mjs` e extrai a opacidade da **luminosidade**, com limiar aferido comparando as saídas lado a lado — abaixo dele o brilho difuso da arte vira uma nuvem cinza em volta do desenho, acima o traço esfarela.

**A Regra da Marca sem Moldura.** A marca aparece em traço, sem contêiner colorido em volta, exceto no favicon — que precisa de fundo próprio porque a aba do navegador não oferece um.

### O Cartão

Representação do cartão cadastrado, em proporção real (1,586:1), Bloco de tinta com raio de 18px. Contém chip, símbolo de aproximação, número mascarado em Geist Mono com espaçamento em grupos de quatro, nome do titular e bandeira. Não é ornamento: os dados vêm da conta cadastrada, e sem conta o espaço mostra um convite a cadastrar em vez de um cartão fictício.

### Gráficos

- **Composição por categoria:** barras horizontais ordenadas em Tinta, com rótulo e valor diretos. A barra é proporcional à maior categoria, não ao total.
- **Fluxo:** área com curva suave em Tinta sobre preenchimento em degradê de opacidade (nunca de matiz), com linha vertical de rastreamento e ponto no valor sob o cursor.
- **Resultado anual:** colunas divergentes a partir do zero. O sinal é codificado pela posição antes de qualquer outra coisa; a coluna negativa recebe preenchimento vazado com contorno, para se distinguir da positiva também na forma.
- **Entrou, saiu e guardou:** colunas agrupadas por mês, uma por categoria de fluxo — cada uma na identidade de cor fixa (ver Colors), com legenda obrigatória como âncora do significado.
- **Eixo de período:** pílulas de mês; a selecionada é um Bloco de tinta.
- Marcas finas: coluna com no máximo 20px, linha de 2px, grade horizontal em hairline sólida.
- **Texto de gráfico nunca veste cor de série ou de fluxo.** Rótulos e eixos em Tinta Secundária, sempre — inclusive no gráfico colorido.

## Do's and Don'ts

### Do:

- **Do** manter no máximo três blocos de tinta cheia por tela.
- **Do** dar a cada painel a sombra de duas camadas: contato curto e difusão longa.
- **Do** acompanhar todo estado de um sinal textual ou de forma — sinal, ícone, preenchimento, inversão.
- **Do** inverter o painel inteiro para tinta quando um limite estourar, e só nesse caso.
- **Do** usar a face monoespaçada tabular em todo valor em coluna, e a face sans proporcional na Figura.
- **Do** tratar o estado vazio como tela projetada: é o primeiro contato de quem avalia o projeto.

### Don't:

- **Don't** introduzir matiz fora das três exceções fechadas (retrato de avatar; identidade de fluxo; ilustração de login) — nem em alerta, nem em estado ativo, nem numa quarta categoria de gráfico, nem dentro do `AppShell`/`AdminShell`. Uma cor nova pede uma regra nomeada nesta seção antes de qualquer linha de código.
- **Don't** deixar a cor da identidade de fluxo ser a única leitura de um valor. Ela mora no ícone, na marca de gráfico, na Figura e no anel/barra de progresso — nunca sozinha, nunca no algarismo pequeno de uma lista.
- **Don't** dar ao estado `warning` de orçamento uma terceira cor. O anel e a barra de progresso são binários — Receita ou Despesa — para manter a paleta em duas rampas; ver "A Regra do Status Emprestado".
- **Don't** usar sombra dupla clara-e-escura (o efeito estampado do neumorfismo): reduz a nitidez da borda e envelhece rápido.
- **Don't** usar gradiente de matiz. Degradê só de opacidade, e só no preenchimento de área de gráfico.
- **Don't** aninhar folha dentro de folha; agrupamento interno usa Rebaixado.
- **Don't** passar de três séries num gráfico: a quarta vira um cinza indistinguível.
- **Don't** abrir a tela com quatro painéis de métrica de tamanho idêntico.
- **Don't** dar seletor de período próprio a um painel; um controle governa a rota.
- **Don't** animar a entrada da página.
