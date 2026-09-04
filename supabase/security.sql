-- =============================================================================
-- Endurecimento do banco — CapyPay
-- =============================================================================
--
-- Rode este script inteiro no **SQL Editor** do Supabase, uma vez, depois das
-- migrações do SETUP.md. Ele não cria tabela nenhuma: ajusta permissões e
-- políticas do que já existe.
--
-- Todo comando é idempotente (`drop policy if exists` antes de criar, `create
-- or replace` nas funções). Rodar duas vezes não faz mal.
--
-- O que ele resolve, em ordem de gravidade:
--
--   1. A verificação em duas etapas era só de tela. Uma sessão que passou pela
--      senha e parou antes do código continuava podendo ler e escrever os
--      dados financeiros pela API REST do projeto — o guarda de rota que a
--      barrava mora no navegador, e o navegador é de quem ataca.
--   2. O navegador escrevia direto em `bank_connections`. Era um segundo
--      caminho para uma conexão bancária nascer, sem passar pela validação de
--      posse que a Edge Function faz.
--   3. Nenhum teto de tamanho no documento financeiro: uma conta podia gravar
--      gigabytes numa linha só.
--   4. Permissões de `anon` e `authenticated` deixadas no padrão do Postgres em
--      tabelas que ninguém deveria alcançar direto.
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. A verificação em duas etapas passa a valer no servidor
-- -----------------------------------------------------------------------------
--
-- A regra, em uma frase: **quem cadastrou um aplicativo autenticador só
-- alcança os próprios dados com a sessão já elevada a `aal2`.** Quem não
-- cadastrou segue entrando com `aal1`, sem nenhuma mudança — a proteção não
-- pode punir quem ainda não a ativou.
--
-- As políticas são `restrictive`, e isso é essencial: elas se somam com E às
-- políticas de posse que já existem, em vez de abrir um caminho novo. Uma
-- política permissiva a mais concederia acesso; uma restritiva só tira.
--
-- A pergunta mora numa função, e não escrita dentro de cada política, por dois
-- motivos. O primeiro é repetição: são três tabelas, e três cópias da mesma
-- regra divergem na primeira correção feita num lugar só. O segundo é de
-- permissão, e é o que decide: a expressão de uma política roda com os
-- privilégios de quem faz a consulta, e `auth.mfa_factors` pertence ao schema
-- do Supabase Auth, que o papel `authenticated` não alcança. Uma função
-- `security definer` faz a leitura com os privilégios de quem a criou — que é
-- exatamente para isso que ela existe — e devolve para a política só um
-- sim ou não.

create or replace function public.mfa_satisfeita()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    -- Sessão já elevada: nada mais a perguntar.
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    -- Ou a conta não tem aplicativo autenticador confirmado, e `aal1` é o
    -- nível legítimo dela. Quem ainda não ativou a verificação não pode ser
    -- barrado por ela.
    or not exists (
      select 1
        from auth.mfa_factors
       where auth.mfa_factors.user_id = auth.uid()
         and auth.mfa_factors.status = 'verified'
    );
$$;

revoke all on function public.mfa_satisfeita() from public, anon;
grant execute on function public.mfa_satisfeita() to authenticated;

-- As políticas abaixo chamam a função dentro de `(select ...)`, e não direto.
-- Não é enfeite de estilo: escrita direta, a expressão é avaliada **por
-- linha**, e a função consulta uma tabela. Envolvida num subselect sem
-- referência à linha, o planejador a promove a InitPlan e a executa uma vez
-- por consulta. É a mesma recomendação que o Supabase faz para `auth.uid()`, e
-- vale mais aqui, porque isto não é a leitura de uma claim: é um `exists`
-- contra `auth.mfa_factors`.

drop policy if exists "exige segundo fator quando ha fator" on public.user_finance_data;
create policy "exige segundo fator quando ha fator"
  on public.user_finance_data
  as restrictive
  to authenticated
  using ((select public.mfa_satisfeita()));

drop policy if exists "exige segundo fator quando ha fator" on public.profiles;
create policy "exige segundo fator quando ha fator"
  on public.profiles
  as restrictive
  to authenticated
  using ((select public.mfa_satisfeita()));

-- `bank_connections` pode não existir: ela só nasce com a integração da Pluggy
-- configurada (etapa opcional do SETUP.md). O bloco abaixo simplesmente não faz
-- nada quando a tabela não está lá, para o script inteiro continuar rodando de
-- ponta a ponta em qualquer instalação.
do $$
begin
  if to_regclass('public.bank_connections') is not null then
    execute $sql$
      drop policy if exists "exige segundo fator quando ha fator" on public.bank_connections;
      create policy "exige segundo fator quando ha fator"
        on public.bank_connections
        as restrictive
        to authenticated
        using ((select public.mfa_satisfeita()));
    $sql$;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 2. A conexão bancária passa a ter um caminho só para nascer
-- -----------------------------------------------------------------------------
--
-- O navegador continua **lendo** as próprias conexões (a tela precisa disso) e
-- continua podendo **remover** uma (desvincular é decisão de quem é dono). O
-- que ele perde é criar e alterar.
--
-- O motivo é que criar uma conexão exige uma pergunta que o navegador não tem
-- como fazer: "este identificador já é de outra pessoa?". As linhas dos outros
-- são invisíveis para ele por RLS — o que é correto —, então a checagem só
-- existe onde a chave de serviço enxerga a tabela inteira, e é lá que a
-- gravação tem de acontecer. Ver `supabase/functions/pluggy-sync/index.ts`,
-- ação `register`.

do $$
begin
  if to_regclass('public.bank_connections') is not null then
    execute $sql$
      revoke insert, update on public.bank_connections from authenticated;

      drop policy if exists "insert own connections" on public.bank_connections;
      drop policy if exists "update own connections" on public.bank_connections;
    $sql$;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 3. Teto de tamanho do documento financeiro
-- -----------------------------------------------------------------------------
--
-- `user_finance_data.data` é uma coluna `jsonb` sem limite próprio: uma conta
-- podia gravar o que quisesse ali, inclusive de propósito. Cinco megabytes são
-- ordens de grandeza acima de qualquer uso real (o documento de anos de
-- lançamentos vive na casa das centenas de quilobytes) e pequenos o bastante
-- para o abuso não valer a pena.
--
-- Um gatilho, e não um `check`: o Postgres exige função imutável em restrição
-- de verificação, e as que medem tamanho não são. O gatilho faz a mesma coisa e
-- deixa uma mensagem que diz o que aconteceu.

create or replace function public.limitar_tamanho_do_documento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_column_size(new.data) > 5 * 1024 * 1024 then
    raise exception 'Documento financeiro grande demais (limite de 5 MB).'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists user_finance_data_limita_tamanho on public.user_finance_data;
create trigger user_finance_data_limita_tamanho
  before insert or update on public.user_finance_data
  for each row execute function public.limitar_tamanho_do_documento();


-- -----------------------------------------------------------------------------
-- 4. Permissões explícitas, em vez do padrão herdado
-- -----------------------------------------------------------------------------
--
-- O Postgres do Supabase concede acesso a `anon` e `authenticated` em tabela
-- nova do schema `public` por padrão. Onde o RLS está correto isso não abre
-- nada — política ausente já nega —, mas depender de uma camada só é depender
-- de nunca alguém criar uma política permissiva por engano. As duas camadas
-- dizendo a mesma coisa é o que faz um erro numa delas não virar incidente.

-- `profiles`: o navegador lê o próprio papel, e nada mais. Quem promove alguém
-- a administrador é a Edge Function, com a chave de serviço. Sem este revoke,
-- uma política de update criada por descuido viraria escalada de privilégio
-- direta — a conta se promovendo sozinha.
revoke insert, update, delete on public.profiles from authenticated, anon;
revoke all on public.profiles from anon;

-- `user_finance_data`: nunca alcançável sem sessão.
revoke all on public.user_finance_data from anon;

-- `admin_audit_log`: nem para ler. Quem lê é a Edge Function, que confirma o
-- papel de administrador antes.
revoke all on public.admin_audit_log from anon, authenticated;

-- `app_defaults`: hoje **nenhuma** tela lê esta tabela direto — os padrões
-- chegam pela Edge Function. Se um dia o aplicativo passar a lê-la do
-- navegador, devolva `grant select ... to authenticated` junto com a política
-- de leitura.
revoke all on public.app_defaults from anon, authenticated;

do $$
begin
  if to_regclass('public.bank_connections') is not null then
    execute 'revoke all on public.bank_connections from anon';
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 5. Funções com caminho de busca fixo
-- -----------------------------------------------------------------------------
--
-- `handle_new_user` roda como `security definer`, ou seja, com os privilégios
-- de quem a criou. Uma função assim sem `search_path` fixo é o caminho clássico
-- de escalada no Postgres: quem consegue criar um objeto num schema que venha
-- antes na busca faz a função chamar o objeto dele, com privilégios que não são
-- dele. `set search_path = ''` obriga todo nome a ser escrito por extenso, e é
-- por isso que os nomes abaixo aparecem qualificados.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user');
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =============================================================================
-- Conferência — rode depois e leia o resultado
-- =============================================================================
--
-- 1. Toda tabela do schema público com RLS ligada:
--
--    select relname, relrowsecurity
--      from pg_class
--     where relnamespace = 'public'::regnamespace and relkind = 'r';
--
--    `relrowsecurity` precisa ser `true` em todas. Uma tabela `false` aqui está
--    aberta para qualquer pessoa com a chave pública do projeto — que viaja no
--    pacote do navegador e não é segredo.
--
-- 2. O que `anon` ainda alcança:
--
--    select table_name, privilege_type
--      from information_schema.role_table_grants
--     where grantee = 'anon' and table_schema = 'public';
--
--    O resultado esperado é vazio.
--
-- 3. As políticas de cada tabela, para conferir que as restritivas estão lá:
--
--    select tablename, policyname, permissive, cmd
--      from pg_policies
--     where schemaname = 'public'
--     order by tablename, policyname;
--
-- E o teste que nenhum script substitui: entre com **duas** contas diferentes,
-- pegue o `access_token` de uma no DevTools e tente ler a linha da outra
-- direto na API REST do projeto. A resposta certa é lista vazia, e não erro —
-- RLS filtra, não recusa. É o teste que o SETUP.md aponta como o maior risco em
-- aberto, e ele continua sendo o único que prova que as políticas fazem o que
-- dizem.
