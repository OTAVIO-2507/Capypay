# Segurança e proteção de dados

Este documento existe para uma pergunta ser respondível: **o que protege os
dados financeiros de quem usa o CapyPay, e onde essa proteção pode falhar.**

O que ele descreve é o estado do repositório. Duas coisas moram fora dele — as
políticas do banco e as Edge Functions publicadas — e por isso a última seção
lista o que precisa ser aplicado no Supabase para o que está escrito aqui ser
verdade em produção.

## O que há para proteger

Três coisas, em ordem de dano se vazarem:

1. **O documento financeiro de cada conta** (`user_finance_data.data`): todos os
   lançamentos, valores, contas bancárias, metas e limites. É o produto inteiro
   numa linha de banco.
2. **A identidade de cada conta** (`auth.users`, `profiles`): e-mail, papel,
   fatores de verificação em duas etapas.
3. **As credenciais de integração**: a `service_role key` do Supabase e o par
   `clientId`/`clientSecret` da Pluggy. Qualquer uma delas no navegador é o
   banco de dados inteiro aberto, para todas as contas de uma vez.

## Como cada camada segura o que segura

**A chave pública do projeto Supabase não é segredo.** Ela viaja no pacote
JavaScript e qualquer pessoa a extrai do site publicado — é assim por
construção. O que impede alguém de usá-la para ler dados alheios é a Row Level
Security do Postgres, e só ela: toda tabela tem RLS ligada, e as políticas
comparam `auth.uid()` com o dono da linha. Uma tabela nova sem RLS neste projeto
é um vazamento imediato de todas as linhas dela, não um descuido de estilo.

**A chave de serviço nunca sai do servidor.** Ela vive nas quatro Edge
Functions em `supabase/functions/`, e dentro delas o banco não protege nada —
RLS é ignorada por definição para esse papel. Toda a proteção ali é o código, e
por isso as funções seguem sempre a mesma ordem, sem exceção: sessão válida,
segundo fator quando a conta o exige, papel de administrador quando a ação é de
administração, freio de repetição, validação da entrada, e só então a ação.

**A verificação em duas etapas vale no servidor, e não só na tela.** Uma sessão
que passou pela senha e parou antes do código existe e é válida — ela vale
`aal1`. Enquanto a decisão de barrá-la morava só no guarda de rota, quem tivesse
apenas a senha continuava alcançando a API REST do projeto direto, sem nunca
digitar o código; o guarda protegia a tela, e a tela nunca foi a única porta.
Hoje as políticas do banco exigem `aal2` de quem tem aplicativo autenticador
cadastrado (`supabase/security.sql`), e as Edge Functions recusam a sessão
`aal1` dessas contas (`supabase/functions/_shared/auth.ts`). Quem não ativou a
verificação continua entrando normalmente: a proteção não pode punir quem ainda
não a escolheu.

**Uma conexão bancária tem um caminho só para nascer.** A tabela
`bank_connections` é a única coisa que amarra um `itemId` da Pluggy a uma conta,
e as credenciais usadas para ler o extrato são da aplicação, não de quem chama —
a Pluggy responde qualquer item que ela conheça, sem perguntar de quem é. Por
isso a gravação acontece só na Edge Function, que enxerga a tabela inteira e
consegue perguntar "este identificador já é de outra pessoa?", coisa que o
navegador não tem como fazer: as linhas dos outros são invisíveis para ele, e é
correto que sejam.

**O que o navegador pode carregar e para onde pode falar é declarado.** A
política de segurança de conteúdo é montada no build (`vite.config.ts`) com o
endereço real do projeto Supabase e o resumo do único script inline da página.
Ela é a diferença entre um XSS que rouba a sessão e um XSS que não tem para onde
mandar nada: o token de acesso vive no armazenamento do navegador, e um
`connect-src` restrito fecha a saída.

## O que foi corrigido nesta revisão

As três primeiras eram exploráveis por uma conta comum, sem nada além de uma
sessão válida.

**Sequestro de conexão bancária.** `pluggy-sync`, na ação `register`, gravava
com `upsert(..., { onConflict: 'item_id' })` usando a chave de serviço. Quem
informasse o `itemId` de outra pessoa reescrevia o dono da linha para si e, na
busca seguinte, lia o extrato bancário dela — passando por uma checagem de posse
que ele mesmo tinha acabado de reescrever. A linha existente decide agora, e ela
nunca troca de dono.

**Escrita direta em `bank_connections` pelo navegador.** As políticas de insert
e update davam ao cliente um segundo caminho para criar uma conexão, sem passar
pela validação de posse da função. Os dois caminhos existiam, e só um validava —
o que é o mesmo que nenhum. O `revoke` está em `supabase/security.sql`.

**Verificação em duas etapas sem efeito no servidor.** Descrita acima.

**Destino livre no link de convite.** `admin-users`, na ação `invite`, repassava
o `redirectTo` do corpo direto ao Supabase. O link de convite carrega um token
de uso único que cria a sessão; um destino escolhido por quem chama entregaria
esse token a um servidor de fora, e quem clicasse teria dado a conta achando que
a estava criando. O destino agora é conferido contra a mesma lista de origens do
CORS.

**Mensagem interna do banco devolvida ao cliente.** O `catch` final de
`admin-users` repassava `cause.message` — nome de coluna, restrição violada,
trecho de consulta. Para quem administra não dizia nada acionável; para quem
sonda, desenhava o schema de graça. Agora vai para o log, e a resposta diz que a
ação não aconteceu.

**Origem de CORS larga demais.** As funções aceitavam qualquer `*.github.io`, o
que é aceitar qualquer página publicada por qualquer pessoa no GitHub Pages.
Hoje a lista é de origens exatas, ajustável por `ALLOWED_ORIGINS` sem publicar
código, e uma origem recusada para a requisição antes da ação — não só depois,
no cabeçalho de resposta.

**Fórmula viajando no CSV exportado.** A descrição de um lançamento chega pronta
do extrato importado, e pode ter sido escolhida por quem fez a transferência. Um
campo que começa por `=`, `+`, `-` ou `@` é fórmula para o Excel e para o Google
Sheets — as aspas do CSV não protegem, porque a planilha as remove antes de
olhar o conteúdo. Células assim passam a ser marcadas como texto, com o cuidado
de não marcar os valores negativos da coluna de dinheiro, que fariam a planilha
parar de somar.

**Ausência de política de segurança de conteúdo, e a página embutível.** Não
havia CSP nenhuma, e nada impedia o aplicativo de ser aberto dentro de um quadro
em página alheia — que é como se colhem cliques de quem acha que está clicando
em outra coisa. A política é montada no build; como `frame-ancestors` é ignorado
quando ela vem por `<meta>` e o GitHub Pages não deixa mandar cabeçalho, o
`index.html` recusa em JavaScript ser pintado dentro de um quadro.

**Sessão que sobrevivia à saída.** `signOut()` encerrava só neste navegador: o
token de renovação continuava valendo até expirar sozinho, e quem tivesse
copiado o armazenamento seguia dentro da conta. Agora a saída é global. Junto
com ela, o documento financeiro que as versões anteriores deixavam em claro no
`localStorage` é apagado (`src/data/localCleanup.ts`) — dado real de quem usou o
produto antes de a conta existir, parado num computador que pode ser
compartilhado.

**Entradas aceitas sem conferência nas funções.** Identificadores que viravam
consulta sem serem UUID, papéis e e-mails adotados como vieram, padrões da
plataforma sem teto de tamanho, corpo de requisição sem limite. A tela validava
tudo isso; `curl` com um JWT válido chega no mesmo lugar sem passar por
formulário nenhum.

**Ainda:** freio de repetição por conta nas três funções chamadas pelo
navegador; teto de 5 MB no documento financeiro; segredo do webhook comparado
por resumo, para o tempo de resposta não entregar nem o tamanho dele; detalhe de
erro do webhook truncado antes de virar linha no banco; `search_path` fixado na
função `security definer` do gatilho de conta nova; viés de módulo removido do
sorteio de senha temporária; teto de 10 MB no arquivo OFX; entidade numérica
fora da faixa Unicode deixando de derrubar a leitura do extrato.

## O que continua sendo verdade, e é decisão consciente

**Um administrador não lê dados financeiros de ninguém.** Não por gentileza: a
Edge Function nunca consulta `user_finance_data`, a `financeStore` não é
carregada em sessão de administração, e as políticas do banco não dariam a linha
de outra conta nem se ela fosse pedida. Excluir uma conta apaga os dados dela
por cascata, sem este código nunca os ter tocado.

**Não há "esqueci minha senha" self-service**, porque não há SMTP configurado.
Só um administrador redefine.

**O último salvamento vence** quando a mesma conta é editada em dois lugares ao
mesmo tempo. É conflito de dados, não de segurança, mas perder um lançamento é
perder um dado real.

**O freio de repetição é por instância**, e a plataforma sobe quantas quiser.
Ele barra laço, e não um ataque distribuído com paciência. Um limite de verdade
exigiria contador compartilhado, com uma escrita no banco por requisição — custo
que só se justifica quando esta barreira provar não bastar.

**`src/data/localRepository.ts` está fora de uso e deveria ser removido.** Nada
o importa; ele permanece porque documenta o formato da base antiga que
`migrate.ts` converte. Religá-lo é uma decisão de privacidade e não de
arquitetura: o que ele grava é o documento financeiro inteiro, em claro, num
armazenamento que sobrevive ao fechar do navegador e que nenhum servidor
consegue apagar depois.

## O que depende de você, no Supabase

Nada do que está escrito acima sobre o banco e as funções vale em produção
enquanto estes três passos não forem dados. O código está no repositório; o
estado do projeto Supabase, não.

**1. Rodar `supabase/security.sql`** no SQL Editor, inteiro, uma vez. É ele que
liga a exigência de segundo fator no banco, fecha a escrita de
`bank_connections` para o navegador, põe teto no documento financeiro e ajusta
as permissões herdadas do padrão do Postgres. Ele é idempotente: rodar duas
vezes não faz mal.

**2. Republicar as quatro Edge Functions.** Elas não passam pelo CI nem pelo
build do site — a versão que roda é a última publicada à mão:

```bash
npx supabase functions deploy admin-users --project-ref <ref>
npx supabase functions deploy pluggy-connect-token --project-ref <ref>
npx supabase functions deploy pluggy-sync --project-ref <ref>
npx supabase functions deploy pluggy-webhook --no-verify-jwt --project-ref <ref>
```

Sem isto, as correções de servidor descritas aqui existem só no repositório. Se
o painel se comportar de um jeito que o código não explica, o mais provável é
que a versão publicada seja mais antiga que a do arquivo.

**3. Conferir as origens.** O padrão são `https://otavio-2507.github.io` e o
`localhost` de desenvolvimento. Se o endereço do site mudar, ajuste sem publicar
código:

```bash
npx supabase secrets set ALLOWED_ORIGINS=https://seu-dominio,http://localhost:5173 --project-ref <ref>
```

**E o teste que nenhum script substitui:** entre com duas contas diferentes,
pegue o `access_token` de uma no DevTools e tente ler a linha da outra direto na
API REST do projeto. A resposta certa é lista vazia, e não erro — a RLS filtra,
não recusa. É o teste que o `SETUP.md` aponta como o maior risco em aberto de
todo este trabalho, e ele continua sendo o único que prova que as políticas
fazem o que dizem.

## Como relatar um problema

Abra uma issue sem detalhes de exploração e peça contato, ou escreva
diretamente ao mantenedor do repositório. Nunca inclua token, chave ou dado real
de conta no relato — nem no seu, nem no de outra pessoa.
