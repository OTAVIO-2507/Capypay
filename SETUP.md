# Configuração do Supabase

O código já está pronto (login, painel admin, Edge Function). O que falta são os
passos manuais que só quem tem acesso ao GitHub e ao Supabase pode fazer — eu
não consigo criar contas nem projetos por você. Siga as três etapas abaixo,
nesta ordem; cada uma destrava a etapa seguinte.

## Etapa 1 — Projeto Supabase e schema

1. Crie um projeto em [supabase.com](https://supabase.com) (plano gratuito cobre um app pessoal).
2. Abra **SQL Editor** e rode o script inteiro abaixo, de uma vez:

```sql
-- Blob financeiro por usuário
create table public.user_finance_data (
  user_id       uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  data          jsonb not null check (jsonb_typeof(data) = 'object'),
  schema_version int not null default 2,
  updated_at    timestamptz not null default now()
);
alter table public.user_finance_data enable row level security;
create policy "select own finance data" on public.user_finance_data for select using (auth.uid() = user_id);
create policy "insert own finance data" on public.user_finance_data for insert with check (auth.uid() = user_id);
create policy "update own finance data" on public.user_finance_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own finance data" on public.user_finance_data for delete using (auth.uid() = user_id);
grant select, insert, update, delete on public.user_finance_data to authenticated;
revoke all on public.user_finance_data from anon;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger user_finance_data_set_updated_at before update on public.user_finance_data
for each row execute function public.set_updated_at();

-- Papel por usuário (user | admin)
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "select own profile" on public.profiles for select using (auth.uid() = id);
grant select on public.profiles to authenticated;
revoke all on public.profiles from anon;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role) values (new.id, new.email, 'user');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
```

3. Bootstrap do primeiro admin — **Authentication → Users → Add user**, crie
   com e-mail e senha (desmarque confirmação por e-mail, não há SMTP
   configurado). Depois, de volta ao SQL Editor:

   ```sql
   update public.profiles set role = 'admin' where email = 'seu-email-aqui@exemplo.com';
   ```

4. Em **Project Settings → API**, copie a **Project URL** e a **anon public
   key**. Crie `.env.local` na raiz do projeto (copie de `.env.example`) e
   preencha as duas.

**Teste manual #1** — rode `npm run dev`, entre com o admin bootstrapado
(deve cair em `/admin`, mas o painel de usuários ainda não funciona — só
depois da Etapa 2) e crie uma segunda conta direto pelo SQL Editor com
`role = 'user'` para confirmar que ela entra no painel financeiro normal e
que os dados persistem entre um refresh.

## Etapa 2 — Edge Function `admin-users`

O código já está em [`supabase/functions/admin-users/index.ts`](supabase/functions/admin-users/index.ts).

```bash
npm install -g supabase
supabase login
supabase init              # se pedir para sobrescrever algo em supabase/, mantenha o que já existe
supabase link --project-ref <ref-do-seu-projeto>   # o ref aparece na URL do painel Supabase
supabase functions deploy admin-users
```

Nenhum secret precisa ser configurado à mão — `SUPABASE_URL`,
`SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já chegam automaticamente
dentro de toda Edge Function.

**Toda mudança no arquivo da função exige `supabase functions deploy
admin-users` de novo.** Ela não passa pelo CI nem pelo build do site. Se o
painel se comportar de um jeito que o código não explica, o mais provável é
que a versão publicada seja mais antiga que a do repositório.

## Etapa opcional — Open Finance com a Pluggy

Só é necessária se você for conectar contas bancárias de verdade. Sem ela o
resto do produto funciona igual; o que falha é a tela de conexão bancária, e
com uma mensagem que diz exatamente isso em vez de um erro genérico.

Crie a aplicação no painel da Pluggy e pegue o `clientId` e o `clientSecret`.
Eles **não entram no repositório** — vão como secret da função:

```bash
supabase secrets set PLUGGY_CLIENT_ID=<seu-client-id>
supabase secrets set PLUGGY_CLIENT_SECRET=<seu-client-secret>
supabase functions deploy pluggy-connect-token
```

A função está em
[`supabase/functions/pluggy-connect-token/index.ts`](supabase/functions/pluggy-connect-token/index.ts).
Ela troca as credenciais por uma API Key de vida curta e devolve ao navegador
**só** o Connect Token — a chave e as credenciais nunca saem do servidor.

O token é sempre carimbado com o id da sessão de quem chamou, e nunca com um
id vindo do corpo da requisição. A documentação da Pluggy passa esse campo
pelo corpo; aceitá-lo assim deixaria qualquer pessoa logada abrir uma conexão
bancária carimbada como de outra, e as contas conectadas chegariam vinculadas
à conta errada.

Como as duas variáveis são lidas na chamada, **trocar um secret exige
`supabase functions deploy pluggy-connect-token` de novo.**

### Aviso automático de novidades (webhook)

Opcional dentro da etapa opcional. Sem ele, conectar o banco funciona; o que
não acontece é o aplicativo ficar sabendo sozinho que há dados novos.

Rode este SQL no **SQL Editor** do Supabase:

```sql
create table public.bank_connections (
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null default 'pluggy',
  item_id       text primary key,
  pending_sync  boolean not null default true,
  last_event    text,
  last_event_at timestamptz,
  last_error    text,
  created_at    timestamptz not null default now()
);
create index bank_connections_user_id_idx on public.bank_connections (user_id);

alter table public.bank_connections enable row level security;

-- O usuário enxerga e mexe só nas próprias conexões.
create policy "select own connections" on public.bank_connections
  for select using (auth.uid() = user_id);
create policy "insert own connections" on public.bank_connections
  for insert with check (auth.uid() = user_id);
create policy "delete own connections" on public.bank_connections
  for delete using (auth.uid() = user_id);

-- Reconectar o mesmo banco é um upsert, então o update precisa existir.
create policy "update own connections" on public.bank_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.bank_connections to authenticated;
revoke all on public.bank_connections from anon;
```

Depois publique a função e registre a URL na Pluggy:

```bash
# Um segredo longo e aleatório. Ele é a única porta da função.
supabase secrets set PLUGGY_WEBHOOK_SECRET=$(openssl rand -hex 32)
supabase functions deploy pluggy-webhook --no-verify-jwt
```

O `--no-verify-jwt` é obrigatório e tem consequência: webhook chega de
servidor para servidor, sem sessão, então a função fica **alcançável por
qualquer um que descubra a URL**. É por isso que o segredo vai na própria
URL, registrada uma vez na Pluggy:

```
https://<ref-do-projeto>.functions.supabase.co/pluggy-webhook?token=<o-segredo>
```

A comparação do segredo é feita em tempo constante. Comparar com `===` sai no
primeiro caractere diferente, e essa diferença de tempo é medível pela rede —
dá para descobrir o segredo letra a letra sem nunca acertá-lo. Quem erra o
token recebe **404**, e não 401: um 401 confirmaria que existe algo ali e que
só falta a chave certa.

**A função não importa nada**, e isso é decisão de projeto, não etapa que
falta. Ela anota que aquele item tem novidade e responde. Dois motivos:

- A Pluggy exige resposta 2XX em cinco segundos. Buscar contas e lançamentos
  na API deles em cascata estoura isso, e resposta lenta é tratada como falha
  e reenviada — uma importação demorada viraria uma importação repetida.
- `user_finance_data` guarda o documento inteiro do usuário numa coluna
  `jsonb`, e o navegador reescreve o documento todo a cada gravação. Uma
  escrita vinda do servidor seria apagada pela gravação seguinte do
  navegador, e vice-versa. Como sincronização acontece justamente enquanto a
  pessoa usa o app, não é risco remoto: é o caso comum.

Quem vai importar é o próprio aplicativo, lendo a marca da tabela — assim a
gravação do documento continua tendo um escritor só.

**Ainda não existe** a tela para remover uma conexão. Enquanto isso, apagar a
linha em `bank_connections` pelo painel do Supabase desliga o aviso daquele
banco.

**Ponto de atenção:** a função usa `ban_duration: '876000h'`/`'none'` para
desativar/reativar contas. Esse formato pode ter mudado entre versões do SDK
— se `Desativar conta` no painel admin falhar, confira a assinatura atual de
`supabase.auth.admin.updateUserById` na versão instalada.

**Teste manual #2**, logado como admin, em **Usuários**. Clique numa linha da
tabela para abrir a ficha da conta e teste cada ação:

- criar conta nova
- redefinir senha, digitando uma senha, e de novo usando "Sortear uma senha"
  (confirme que a senha mostrada no fim funciona mesmo no login)
- desativar e reativar
- promover a administrador e rebaixar de volta
- excluir uma conta descartável

Duas travas devem recusar a ação, e vale conferir que recusam: rebaixar ou
excluir o **único** administrador que existe, e excluir a própria conta com
que você está logado.

> **Enquanto a Etapa 2 não estiver feita, o painel de administração não
> funciona.** Painel e Usuários dependem desta função e vão mostrar só a tela
> de erro "Não foi possível falar com o servidor". A aba **Plataforma** é a
> única que funciona sem ela, porque só lê configuração local.

## Etapa 2b — Auditoria e padrões de conta nova

Uma segunda migração, para as funcionalidades que vieram depois. Rode tudo de
uma vez no **SQL Editor**:

```sql
-- Histórico do que a administração fez -------------------------------------
create table public.admin_audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text not null,
  action      text not null,
  target_id   uuid,
  target_email text,
  detail      text,
  created_at  timestamptz not null default now()
);

create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
-- Nenhuma policy para `authenticated`, de propósito: quem escreve e lê é a
-- Edge Function, com a chave de serviço, que ignora RLS. O navegador não
-- alcança esta tabela nem para ler.
revoke all on public.admin_audit_log from anon, authenticated;

-- `actor_id` fica nulo se a conta do autor for excluída, mas o e-mail
-- permanece: um histórico que apaga quem fez a ação deixa de ser histórico.

-- Padrões que toda conta nova recebe ---------------------------------------
create table public.app_defaults (
  id         int primary key default 1 check (id = 1),
  categories jsonb,
  budgets    jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_defaults (id) values (1) on conflict do nothing;

alter table public.app_defaults enable row level security;

-- Toda conta autenticada **lê** os padrões (é deles que uma conta vazia
-- nasce), mas só a Edge Function escreve.
create policy "read defaults" on public.app_defaults for select using (true);
grant select on public.app_defaults to authenticated;

-- O `revoke` é obrigatório, e não simetria de estilo: o Postgres do Supabase
-- já concede leitura a `anon` por padrão em tabela nova do schema `public`.
-- Sem esta linha, `grant ... to authenticated` não restringe nada, e os
-- padrões ficam legíveis por qualquer um com a chave pública do projeto —
-- que viaja no pacote do navegador.
revoke select on public.app_defaults from anon;
```

Depois disso me avise: eu republico a Edge Function com as ações novas.

## Etapa 2c — Verificação em duas etapas (TOTP)

No painel do Supabase, **Authentication → Providers → Multi-Factor
Authentication**, habilite **TOTP (App Authenticator)**. Sem isso, a tela de
login mostra "A verificação em duas etapas não está habilitada neste projeto
Supabase" no lugar do QR code.

Como funciona no app:

1. Na primeira entrada depois da senha, a tela oferece ativar a verificação e
   já mostra o QR code para escanear no Google Authenticator, Authy ou no
   autenticador do gerenciador de senhas. Quem não quiser agora clica em
   "Agora não", e a oferta volta na próxima vez que o navegador for aberto.
2. Com a verificação ativa, todo login passa a pedir o código de seis dígitos
   depois da senha. Enquanto o código não for aceito, a sessão vale menos
   (AAL1) e o guarda de rota recusa a entrada no app.

**Ativar é no login; desativar é em Ajustes.** O cartão "Verificação em duas
etapas" (Ajustes, nas duas telas: usuário e admin) mostra se está ligada e é
o único lugar que desliga. Ele não ativa nada: quem estiver sem a verificação
lê ali que a oferta aparece na próxima entrada.

Quem perdeu o aparelho não consegue chegar em Ajustes, porque a conta trava
na tela de código. Nesse caso, um admin resolve em **Usuários → (abrir a
conta) → Remover verificação em duas etapas**.

## Etapa 3 — Deploy (GitHub Actions)

Em **Settings → Secrets and variables → Actions** no repositório GitHub,
cadastre dois secrets com os mesmos valores do `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

O workflow (`.github/workflows/ci.yml`) já está configurado para injetá-los no
passo de build. Um push em `main` deve rodar verde de ponta a ponta.

A esteira **não publica** o site: o repositório é privado, e o GitHub Pages
não atende repositório privado no plano gratuito.

**Para voltar a publicar**, torne o repositório público e aponte Settings →
Pages para "GitHub Actions". Depois disso falta devolver ao workflow o job de
deploy (`actions/upload-pages-artifact` e `actions/deploy-pages`) com as
permissões `pages: write` e `id-token: write`, que saíram junto.

Confira também o `base` em `vite.config.ts`: um Pages de projeto serve a
partir de `/<nome-do-repositório>/`, então renomear o repositório sem mexer
nesse valor publica um site com todos os caminhos de asset errados. Hoje ele
está em `/Capypay/`.

**Teste manual #3**, quando houver site publicado: abra-o (não `localhost`) e
confirme que o login funciona a partir dali. Se der erro de CORS, a origem
precisa estar liberada em `supabase/functions/admin-users/index.ts`
(`isAllowedOrigin` já cobre qualquer `*.github.io`).

## O que ainda não existe (decisão consciente, não esquecimento)

- **Sem "esqueci minha senha" self-service.** Só um admin redefine — não há
  SMTP configurado para enviar link de recuperação.
- **Sem controle de conflito entre dispositivos.** Duas abas/aparelhos
  editando a mesma conta ao mesmo tempo: o último salvamento vence.
- **RLS não foi testada contra um JWT de outra conta de verdade.** As
  políticas do script acima parecem corretas, mas isso precisa ser verificado
  manualmente antes de confiar dados reais ao sistema — é o maior risco de
  todo este trabalho.
