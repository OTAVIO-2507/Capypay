<div align="center">

# CapyPay

Painel de finanças pessoais com login real. Lançamentos, limites por categoria e metas — cada conta vê só os próprios dados, isolados no banco por linha; nem um administrador da plataforma tem acesso a eles.

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

</div>

## Visão geral

O aplicativo responde a uma pergunta em poucos segundos: **quanto sobrou este mês, para onde o dinheiro foi e onde os limites estão apertando.**

A interface é inteiramente em preto e branco — folhas de papel apoiadas sobre uma mesa cinza, tinta preta e nenhum matiz. Um único seletor de mês governa a tela inteira, e as pílulas de mês abaixo do gráfico também são controle: clicar nelas muda o período de toda a rota.

Login real fica na frente de tudo. Cada conta é criada por um administrador — não há cadastro público — e os dados vivem no Supabase, isolados por conta via Row-Level Security: o Postgres recusa qualquer leitura ou escrita fora da própria linha, não é uma regra só de interface. Um segundo papel, admin, existe à parte, numa moldura própria, só para gerenciar contas (criar, desativar, redefinir senha) — ele nunca acessa o painel financeiro, nem os próprios dados.

## Funcionalidades

- **Lançamentos** de receita, despesa e aporte em meta, com categoria, data, conta de origem e repetição (semanal, mensal ou anual). Cada cobrança é gerada como um lançamento próprio e pode ser editada isoladamente — a conta de luz muda de valor todo mês.
- **Parcelamentos e Assinaturas** em páginas próprias, porque a unidade das duas é a série e não o lançamento: em Transações, um notebook em 10x são dez linhas soltas que não somam nada. Parcelamento tem total fechado e a pergunta é quanto falta pagar; assinatura não tem total e a pergunta é quanto ocupa por mês — inclusive a projeção anual, que é onde a conta assusta. Quem separa as duas é uma escolha do usuário no formulário, não um palpite sobre o nome ou a categoria.
- **Orçamento por categoria e por mês**, com histórico preservado: alterar o teto de agosto não reescreve o de julho. Três estados visíveis — dentro do limite, perto do limite e estourado.
- **Metas** cujo progresso vem sempre da soma dos aportes vinculados. Não há campo de "valor já guardado" para digitar, então o número na tela nunca discorda do extrato.
- **Contas e cartões** como entidade própria, com ciclo de fechamento e vencimento. O cartão cadastrado é desenhado no painel em proporção real — e sem conta cadastrada, o espaço convida a cadastrar em vez de exibir um cartão fictício.
- **Gráficos**: curva do resultado ao longo do ano com o mês em foco marcado, composição das despesas por categoria e fluxo de seis meses (receitas × despesas × aportes).
- **Modo privacidade**, que mascara todo valor na tela, e **tema claro, escuro ou automático**.
- **Exportação CSV** com separador `;` e BOM UTF-8, pronta para o Excel em português.
- **Login real e contas isoladas**, cada uma vendo só os próprios lançamentos — sem cadastro público, contas nascem pelo painel de admin.
- **Verificação em duas etapas** com aplicativo autenticador (TOTP). O QR aparece na própria entrada, logo depois da senha, e não escondido em ajustes: proteção que mora atrás de dois cliques é proteção que quase ninguém liga. Desativar fica em Ajustes; quem perdeu o aparelho depende de um administrador.
- **Tour de boas-vindas** na primeira entrada, dos dois lados. Ele ilumina a interface de verdade em vez de mostrar uma reprodução dela, e começa pedindo o nome, que é obrigatório: sem ele a saudação do painel abre muda todo dia.
- **Painel de administração**, numa moldura própria: contas (criar, convidar por link, redefinir senha com senha à escolha, desativar, excluir, remover a verificação em duas etapas), relatórios com quatro gráficos, auditoria filtrável e ajustes. Nunca mostra dado financeiro de ninguém.
- **Auditoria imutável**: toda ação de administração é registrada pelo servidor com autor, alvo e hora, sem caminho de edição nem de exclusão pela interface.

## Decisões de projeto

Algumas escolhas que não são óbvias pelo código:

**Dinheiro em centavos inteiros.** A versão anterior guardava reais como ponto flutuante, o que faz `0,1 + 0,2` virar `0,30000000000000004` dentro de uma soma de extrato. Todo valor circula como inteiro; a conversão acontece só na borda.

**Datas como texto `AAAA-MM-DD`, nunca `Date`.** `new Date('2024-03-15')` é interpretado como UTC e, em fuso brasileiro, exibe o dia 14. Tratar a data como string de calendário elimina a classe inteira desse erro.

**Nada derivado é persistido.** O progresso de uma meta, o total gasto por categoria e o saldo acumulado são funções puras sobre os lançamentos. Não há como o dado salvo discordar do dado calculado.

**Um seletor de mês para a rota inteira.** A versão anterior tinha três controles de período espalhados, que podiam discordar entre si e mostrar dois meses na mesma tela.

**A interface não tem cor nenhuma.** Preto, branco e cinzas. Sem matiz para carregar significado, a hierarquia recai sobre coisas mais duráveis — tamanho, peso, densidade e espaço — e nenhum leitor perde informação por não distinguir um matiz de outro. O único acento é o inverso: um bloco de tinta cheia, gasto no máximo três vezes por tela.

**Entrada e saída se distinguem sem cor, de três formas ao mesmo tempo.** A seta antes do valor (sobe na receita, desce na despesa, segue para o lado no aporte), o sinal `+`/`−`, e o peso da tinta — mais o contorno do ícone da categoria. A seta é o recurso que extrato de banco usa há décadas. Qualquer uma sozinha bastaria; é o conjunto que faz a tela sobreviver à impressão em preto e branco e a qualquer tipo de daltonismo.

**Orçamento estourado transborda em vez de ficar vermelho.** A barra enche por completo e o excesso aparece como faixa hachurada a 45° — uma diferença de textura, não de cor. O painel do alerta também inverte para tinta cheia, que num campo monocromático é o evento mais alto disponível.

**Séries de gráfico verificadas, não estimadas.** Sendo monocromáticas, elas formam uma rampa ordinal: um matiz, degraus de luminosidade, aprovados no validador (luminosidade monótona, salto adjacente ≥ 0.06 e ponta clara acima de 2:1 contra a superfície) nos dois temas.

**O painel de administração tem quatro gráficos porque são quatro perguntas.** Ritmo (contas criadas por mês, em colunas), tamanho (total acumulado, em área de degraus — porque um acumulado salta quando uma conta nasce e fica parado até a próxima, e uma diagonal desenharia um crescimento que não aconteceu), composição (disco) e atividade administrativa (calendário de intensidade). Nenhum deles repete a resposta de outro.

**Cada gravação local sabe de quem é.** As preferências de administração (nome, avatar, marcador de tour) moram no navegador, não no servidor, porque uma sessão de administração nunca abre um documento financeiro. Elas carregam o id do dono: duas contas de administração no mesmo computador não dividem nome nem avatar, e a segunda pessoa não perde o tour porque a primeira já o fez. Só o tema sobrevive à troca, por ser preferência de monitor e não de pessoa.

## Tecnologias

| Tecnologia | Aplicação no projeto |
| --- | --- |
| React 19 + TypeScript | Interface e modelo de domínio tipado |
| Vite 8 | Build, dev server e divisão de código |
| Tailwind CSS 4 | Tokens semânticos em CSS e estilização |
| Zustand | Estado da aplicação e persistência |
| Supabase Auth MFA | Verificação em duas etapas por TOTP, conferida no servidor |
| Recharts | Gráficos de fluxo e de resultado anual |
| Lucide | Iconografia |
| Geist + Figtree | Interface e logotipo, servidas pelo próprio projeto |
| Supabase | Autenticação, banco (Postgres + RLS) e a Edge Function de administração |

## Como executar

Precisa de um projeto Supabase (schema e Edge Function em [`supabase/`](supabase/); o passo a passo está em [`SETUP.md`](SETUP.md)). Com o projeto criado:

```bash
git clone https://github.com/OTAVIO-2507/Capypay.git
cd Capypay
npm install
cp .env.example .env.local   # preencha com a URL e a anon key do seu projeto
npm run dev
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento em `http://localhost:5173` |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build local para conferência |
| `npm run typecheck` | Verificação de tipos sem emitir arquivos |
| `npm test` | Testes do núcleo de cálculo |

A Edge Function de administração fica **fora** deste ciclo: é código Deno, não passa pelo build nem pelo CI, e toda mudança nela exige `npx supabase functions deploy admin-users` à mão.

Cada push em `main` e cada pull request disparam a esteira do GitHub Actions, que roda verificação de tipos, testes e build. Ela não publica: o repositório é privado, e o GitHub Pages não atende repositório privado no plano gratuito. O build continua na esteira porque quebrar o empacotamento é uma classe de erro que typecheck e teste não pegam.

Os testes rodam **sem** as variáveis do Supabase, de propósito. Teste de lógica pura não deve precisar de backend configurado, e foi assim que a esteira pegou um teste que arrastava o cliente pelo import. As chaves entram só no passo de build.

## Testes

202 testes cobrem o que erra em silêncio: conversão de dinheiro, aritmética de datas, a migração da base antiga, os avisos derivados, as métricas do painel de administração e a lógica pura de autenticação, verificação em duas etapas e roteamento por papel.

Alguns existem por causa de um erro que já aconteceu. O roteiro de cada tour é comparado com a barra lateral correspondente, porque o do usuário nasceu pulando três destinos; um menu novo sem parada no tour quebra o teste em vez de sumir em silêncio. A troca de dono das preferências de administração é testada porque sem ela a segunda pessoa a entrar naquele computador era cumprimentada pelo nome da primeira.

A migração é a parte mais testada porque roda automaticamente na primeira abertura e transforma lançamentos reais. Um erro ali não mostra tela de erro — mostra número errado. Os testes verificam que nenhum lançamento com valor se perde, que reais viram centavos com arredondamento correto, que categoria desconhecida cai em "Outros" em vez de sumir e que um aporte cuja meta não existe mais vira despesa, já que o dinheiro saiu do saldo de qualquer forma.

## Estrutura

```
src/
├── domain/      Tipos, catálogo de categorias e cálculos derivados (funções puras)
├── data/        Persistência (Supabase), migração da base antiga e dados de demonstração
├── store/       Estado da aplicação: financeStore (dados) e authStore (sessão/papel), separados de propósito
├── components/  Design system: Card, Button, Field, Dialog, Money, Logo, Wordmark…
├── features/    Blocos por assunto: dashboard, charts, transactions, settings, admin, security, onboarding
├── pages/       Uma rota por arquivo, incluindo LoginPage e as cinco rotas de admin
├── app/         Shells (financeiro e admin), navegação, roteador, guardas de rota e tema
├── assets/      Marca já processada, importada pelo código
└── lib/         Dinheiro, datas, formatação

tools/           Scripts rodados à mão, fora do build
supabase/        Edge Function de administração (Deno) — fora do build do front-end, deploy manual
```

A marca entra na interface como **máscara CSS**, e não como elemento de imagem: a arte é traço monocromático e a barra lateral inverte de tinta para papel entre os temas, então uma `<img>` ficaria invisível em metade dos casos. Como máscara ela pinta com `currentColor` e acompanha o contexto sozinha. A conversão da arte de origem — que é traço branco sobre fundo cinza opaco — está em `tools/build-logo.mjs`.

A arte de origem dos avatares e da marca **não é versionada**: são PNGs de tamanho de geração, 41 MB somados, contra 264 KB do que o aplicativo carrega (`src/assets/`, 256×256 em JPEG). Git guarda binário para sempre, e o produto só precisa do derivado.

`PRODUCT.md` registra o que o produto é e para quem. `DESIGN.md` registra o sistema visual — tokens, regras e componentes.

## Roteiro

O próximo passo é ler os dados direto da instituição financeira por um agregador do Open Finance (Pluggy, Belvo ou equivalente), cobrindo compras do cartão, faturas, extrato da conta corrente e posição de investimentos.

**Isso ainda não existe.** O aplicativo não se comunica com nenhum banco e todo lançamento é manual. O que já está pronto é a estrutura que a integração vai exigir: `Transaction.source` distingue o que foi digitado do que veio sincronizado, `Transaction.externalId` é a chave de deduplicação entre sincronias, `Account` existe como entidade própria, e a camada de persistência é assíncrona por trás de uma interface (`FinanceRepository`) — hoje implementada sobre o Supabase, antes sobre `localStorage` — para que trocar de novo não obrigue a reescrever a aplicação. O contrato previsto está escrito em [`src/data/repository.ts`](src/data/repository.ts).

A parte que antes faltava — um servidor para guardar as credenciais e o token do agregador, que não podem viver no navegador — já existe agora, na forma do Supabase e da Edge Function de administração. O que resta é só a integração em si.
