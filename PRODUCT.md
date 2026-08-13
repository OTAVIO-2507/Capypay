# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Uso pessoal continua sendo o núcleo: Otávio, o próprio autor, controlando as finanças pessoais dele no Brasil. A diferença é que agora existe login real por trás — uma reversão consciente do "sem servidor" original (ver Positioning). Contas nascem só pela mão de um administrador, nunca por cadastro público; cada conta vê e edita só os próprios dados, nunca os de outra pessoa. Um segundo papel, admin, existe só para gerenciar essas contas — criar, desativar, redefinir senha — e nunca enxerga o extrato de ninguém, nem o próprio: uma sessão admin não acessa o painel financeiro.

Um momento de uso permanece; o outro foi suspenso pelo login real:

1. **Uso real, recorrente.** Lançar um gasto logo depois que ele acontece (celular ou desktop), conferir se o orçamento do mês está estourando, ver quanto foi para as metas. São sessões curtas, de segundos, repetidas várias vezes por semana.
2. ~~**Avaliação por terceiros.**~~ Recrutadores e outros desenvolvedores abrindo a demonstração pública pelo GitHub, sem nenhum dado cadastrado — **suspenso**. A tela de login agora fica na frente de tudo, e sem cadastro público não há como um visitante sem conta chegar ao produto. Decisão consciente ao introduzir o login real: aceitar essa perda por ora, em vez de construir um caminho de demonstração sem senha. Revisitar se voltar a incomodar — as opções descartadas foram credenciais fixas de demonstração ou uma rota pública somente-leitura.

O estado vazio continua sendo o primeiro contato de quem tem conta, mesmo sem esse público externo.


## Product Purpose

Centralizar o controle financeiro pessoal em uma única tela: registrar receitas, despesas e aportes em metas; categorizar cada movimentação; definir limites de gasto por categoria e por mês; e acompanhar a evolução em gráficos que respondem imediatamente ao lançamento.

Sucesso é o autor conseguir responder, em menos de cinco segundos e sem calcular nada de cabeça: *quanto sobrou, para onde meu dinheiro foi este mês, e estou estourando algum limite?*

## Positioning

Até aqui, aplicativo de finanças pessoais que rodava inteiramente no navegador, sem servidor, sem cadastro e sem enviar dado financeiro para lugar nenhum. Essa promessa foi revertida por decisão explícita: login real e um painel de administração exigem uma conta de verdade, então os dados agora vivem no Supabase (Postgres com autenticação e controle de acesso por linha), um conjunto isolado por conta — nunca um blob compartilhado.

O que sobrevive da promessa original, agora reformulada: **seus dados não são visíveis a ninguém além de você**, nem mesmo a um administrador da plataforma — o papel admin gerencia só o acesso (criar/desativar conta, redefinir senha), nunca o conteúdo financeiro. Privacidade deixou de ser "o dado nunca sai do dispositivo" e passou a ser "o dado é seu, isolado por conta, e nem quem administra a plataforma pode vê-lo".

Isso também muda o que resta do roteiro de integração bancária: a exigência de servidor que antes era o problema central da sincronização já está resolvida por este backend — a pergunta que sobra é só como o dado sincronizado convive com o modelo por conta.

## Operating Context

- **Moeda e formato:** Real brasileiro (BRL), `pt-BR`, datas em formato brasileiro, separador decimal vírgula.
- **Dispositivos:** desktop para análise e configuração; celular para lançamento rápido. Ambos são caminhos de primeira classe.
- **Ciclo mental:** o mês é a unidade de raciocínio dominante. Orçamentos são definidos por mês, o histórico de meses anteriores é preservado, e a comparação entre meses é a análise mais frequente.
- **Modo privacidade:** existe um estado em que todos os valores monetários são mascarados na tela, para uso em ambiente público ou ao compartilhar a tela. É um requisito real, não um enfeite.
- **Exportação:** CSV com separador `;` e BOM UTF-8, porque o destino é o Excel em português.

## Capabilities and Constraints

Funcionalidades confirmadas, todas já existentes e que devem sobreviver à reestruturação:

- Lançamento de transações nos tipos receita, despesa e aporte em meta, com descrição, valor, data e categoria.
- Transações recorrentes/parceladas: geração de N lançamentos com frequência semanal, mensal ou anual.
- Metas financeiras com nome, ícone, valor-alvo e progresso alimentado exclusivamente por aportes explícitos.
- Orçamentos (limites de gasto) por categoria **e por mês**, com histórico mensal preservado.
- Filtros de transação por texto, categoria e tipo; filtros de gráfico por mês e categoria.
- Gráficos: composição de gastos por categoria, comparativo mensal receitas/despesas/metas, e evolução do saldo ao longo de um ano navegável.
- Modo claro e escuro, com preferência persistida.
- Modo privacidade (mascaramento de valores).
- Exportação CSV de todos os lançamentos.
- Zerar todos os dados.

Restrições técnicas:

- **Backend: Supabase.** Autenticação e persistência (Postgres, uma linha por conta, isolada por RLS). O front-end continua sendo um site estático no GitHub Pages — só fala com o Supabase direto do navegador, sem servidor próprio. Gerenciar contas (criar, desativar, redefinir senha) passa por uma Edge Function, porque essas ações exigem a `service_role key`, que não pode chegar ao navegador.
- **Sem migração automática do `localStorage` antigo.** Dados gravados nas chaves `financeFlowData` (formato anterior) ou `controle-financeiro/v2` (localStorage, pré-Supabase) ficam onde estão — foi decisão consciente não os importar para a conta Supabase na primeira abertura. "Dados de exemplo" continua existindo, mas semeia a conta logada, não o navegador.
- **Estado vazio é um caminho crítico**, não um caso de borda: é o primeiro contato de todo avaliador externo — mas ver a nota em Users sobre o login agora ficar na frente desse caminho para quem não tem conta.

Roteiro futuro confirmado (não construir agora, mas o modelo de dados não pode inviabilizar):

- Sincronização com instituição financeira via agregador (padrão Open Finance brasileiro — Pluggy, Belvo ou equivalente), abrangendo transações de cartão de crédito, faturas e ciclo do cartão, extrato de conta corrente, e posição de investimentos.
- Isso implica modelar, desde já, com espaço para: contas e cartões como entidades próprias, origem do lançamento (manual vs. sincronizado), identificador externo para deduplicação, e status de conciliação.

## Brand Commitments

- Nome: **CapyPay**. A marca é uma capivara com uma pilha de moedas — o trocadilho entre "capivara" e "pay" é a identidade.
- Idioma da interface: português do Brasil, integralmente.
- Marca visual fornecida pelo usuário: capivara em traço de espessura única, monocromática, com pilha de moedas.
- Referência visual que o usuário tornou vinculante: painéis flutuantes sobre fundo neutro, **inteiramente monocromáticos**, com barra lateral expandida e o item ativo se fundindo com a página. Nome em face pesada e geométrica.
- Repositório público em `github.com/OTAVIO-2507/Capypay`. O nome define o caminho de publicação no GitHub Pages (`/Capypay/`), então renomear o repositório obriga a mexer no `base` do Vite junto: sem isso o site publicado sobe com todos os caminhos de asset errados.

## Evidence on Hand

- Implementação incumbente completa e funcional: `index.html`, `src/app.js` (~1.550 linhas), `src/style.css`.
- README com descrição, tabela de tecnologias e link de demonstração.
- **Não existe:** logotipo, fotografia, depoimento, dado de usuário real publicável, base de clientes ou métrica de uso. Nada disso pode ser fabricado. Qualquer dado exibido em demonstração deve ser evidentemente sintético e rotulado como tal.

## Product Principles

1. **O mês manda.** Toda análise, limite e comparação se ancora no mês. Qualquer visão que ignore o recorte mensal está respondendo à pergunta errada.
2. **Lançar tem que ser mais rápido que anotar no papel.** O caminho de registrar uma despesa é o caminho mais percorrido do produto e deve permanecer o mais curto.
3. **O dado é do usuário, isolado por conta, e ninguém mais enxerga.** A promessa deixou de ser "nunca sai do dispositivo" — agora é "vive numa conta que só o dono acessa, nem um administrador da plataforma vê o conteúdo". Privacidade continua posição de produto, não detalhe de implementação.
4. **Vazio também é uma tela.** O estado sem dados é o primeiro contato de todo avaliador; ele precisa ensinar e convencer, nunca parecer quebrado.
5. **Preparado para o banco, útil sem ele.** Nenhuma decisão estrutural pode depender de uma integração que ainda não existe, e nenhuma pode impedi-la.

## Accessibility & Inclusion

Nenhum requisito formal foi estabelecido pelo usuário. Aplicam-se os mínimos não negociáveis: contraste de texto adequado nos dois temas, navegação completa por teclado, alvos de toque adequados no celular, e informação nunca codificada apenas por cor — relevante em especial para receita/despesa e para orçamento estourado, hoje distinguidos por verde/vermelho.
