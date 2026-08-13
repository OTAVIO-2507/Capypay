import { Link } from 'react-router-dom'
import { Icon, type IconName } from '@/components/Icon'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Controls'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ActivityChart } from '@/features/admin/ActivityChart'
import { DonutChart } from '@/features/admin/DonutChart'
import { useAdminUsers } from '@/features/admin/useAdminUsers'
import { greetingTextFor } from '@/features/dashboard/Greeting'
import { TodayLeaf } from '@/features/dashboard/TodayLeaf'
import { todayIso } from '@/lib/date'
import { useAdminProfile } from '@/store/adminPreferences'
import {
  acessosRecentes,
  faixasDeAtividade,
  formatRelativeTime,
  nuncaAcessaram,
  summarizeUsers,
} from '@/features/admin/adminMetrics'

/**
 * A visão de conjunto da plataforma.
 *
 * Tudo aqui é derivado de `listUsers()`: e-mail, papel, criação, último
 * acesso e status. Nenhum número é estimado e nenhum vem de dado financeiro.
 * O painel de administração mostra o que existe ou não mostra nada.
 *
 * A distribuição por último acesso aparece duas vezes, de propósito e não por
 * descuido: disco e barra respondem perguntas diferentes sobre o mesmo dado.
 * O disco dá a proporção contra o todo num relance; a barra dá a comparação
 * entre faixas, que ângulo vizinho não resolve bem. São quatro faixas
 * ordenadas que somam o total, e é isso que autoriza o disco aqui.
 *
 * O que continua fora: um disco de "usuários contra administradores" seria
 * uma pizza de duas fatias, que é um número disfarçado de gráfico. Esse
 * recorte vive nas pastilhas acima, e em Relatórios, onde vira três fatias ao
 * separar as desativadas.
 */
export function AdminDashboardPage() {
  const { users, loading, error, reload } = useAdminUsers()

  // A saudação toma o lugar do título, como no painel financeiro. Desligada,
  // ou sem nome cadastrado, a tela volta a se chamar "Painel": o cabeçalho
  // nunca fica sem nome.
  const perfil = useAdminProfile()
  const saudacao = greetingTextFor(perfil, new Date().getHours())
  const hoje = todayIso()

  if (error) {
    return (
      <>
        <PageHeader title="Painel" description="Visão geral das contas." />
        <Card>
          <EmptyState
            icon="triangle-alert"
            title="O painel não conseguiu carregar as contas"
            description={error}
            action={
              <Button size="sm" variant="quiet" icon="repeat" onClick={() => void reload()}>
                Tentar de novo
              </Button>
            }
          />
        </Card>
      </>
    )
  }

  const lista = users ?? []
  const agora = Date.now()
  const resumo = summarizeUsers(lista, agora)
  const pendentes = nuncaAcessaram(lista)
  const recentes = acessosRecentes(lista, 5)
  const faixas = faixasDeAtividade(lista, agora)

  return (
    <>
      <PageHeader
        title={saudacao || 'Painel'}
        large
        leading={<TodayLeaf date={hoje} />}
        description="Visão geral das contas. Nenhum dado financeiro passa por aqui."
        actions={
          <Button variant="quiet" icon="repeat" onClick={() => void reload()}>
            Atualizar
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          icon="users"
          label="Contas no total"
          value={resumo.total}
          detail={`${resumo.regulares} de uso, ${resumo.admins} de administração`}
          loading={loading}
        />
        <Metrica
          icon="user-check"
          label="Ativas em 30 dias"
          value={resumo.ativas30d}
          detail={
            resumo.total > 0
              ? `${Math.round((resumo.ativas30d / resumo.total) * 100)}% do total`
              : 'Nenhuma conta ainda'
          }
          loading={loading}
        />
        <Metrica
          icon="circle-dashed"
          label="Nunca acessaram"
          value={resumo.nuncaAcessaram}
          detail={
            resumo.nuncaAcessaram > 0 ? 'A senha pode não ter chegado' : 'Todo mundo já entrou'
          }
          loading={loading}
        />
        <Metrica
          icon="user-x"
          label="Desativadas"
          value={resumo.desativadas}
          detail={resumo.desativadas > 0 ? 'Não conseguem entrar' : 'Nenhuma conta bloqueada'}
          loading={loading}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Atividade das contas"
            description="Quando cada uma entrou pela última vez"
          />
          {loading ? (
            <p className="text-[0.8125rem] text-muted">Carregando…</p>
          ) : resumo.total === 0 ? (
            <EmptyState
              icon="users"
              size="sm"
              title="Nenhuma conta ainda"
              description="O disco aparece com o primeiro cadastro."
            />
          ) : (
            /*
             * Disco, e não a lista de barras que estava aqui: são quatro
             * faixas ordenadas que somam o total, que é a definição de
             * parte-do-todo. As barras continuam logo abaixo, porque disco dá
             * proporção num relance e barra dá comparação entre faixas — as
             * duas perguntas que este dado responde.
             */
            <DonutChart
              total={resumo.total}
              slices={faixas.map((faixa) => ({
                id: faixa.id,
                label: faixa.label,
                count: faixa.count,
              }))}
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Comparação entre faixas" description="A mesma leitura, em barra" />
          {loading ? (
            <p className="text-[0.8125rem] text-muted">Carregando…</p>
          ) : (
            <ActivityChart faixas={faixas} />
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader
            title="Precisa de atenção"
            description="Contas criadas que ninguém usou até agora"
            action={
              pendentes.length > 0 ? (
                <Badge tone="strong">{pendentes.length}</Badge>
              ) : null
            }
          />

          {loading ? (
            <p className="text-[0.8125rem] text-muted">Carregando…</p>
          ) : pendentes.length === 0 ? (
            <EmptyState
              icon="check"
              size="sm"
              title="Nada pendente"
              description="Toda conta criada já foi acessada ao menos uma vez."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {pendentes.slice(0, 5).map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="truncate text-[0.8125rem] font-medium text-ink">
                    {user.email}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    criada {formatRelativeTime(user.createdAt, agora)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {pendentes.length > 5 ? (
            <p className="mt-3 text-xs text-muted">
              e mais {pendentes.length - 5} em <LinkUsuarios>Usuários</LinkUsuarios>.
            </p>
          ) : null}
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Últimos acessos" description="Quem entrou por último" />

          {loading ? (
            <p className="text-[0.8125rem] text-muted">Carregando…</p>
          ) : recentes.length === 0 ? (
            <EmptyState
              icon="circle-dashed"
              size="sm"
              title="Nenhum acesso registrado"
              description="Assim que alguém entrar pela primeira vez, aparece aqui."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {recentes.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="truncate text-[0.8125rem] font-medium text-ink">
                      {user.email}
                    </span>
                    {user.role === 'admin' ? <Badge tone="quiet">Admin</Badge> : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {formatRelativeTime(user.lastSignInAt, agora)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

function LinkUsuarios({ children }: { children: string }) {
  return (
    <Link to="/admin/usuarios" className="font-medium text-ink underline underline-offset-2">
      {children}
    </Link>
  )
}

function Metrica({
  icon,
  label,
  value,
  detail,
  loading,
}: {
  icon: IconName
  label: string
  value: number
  detail: string
  loading: boolean
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted">{label}</p>
        <Icon name={icon} size={16} className="text-faint" />
      </div>
      {/*
        Sem `tnum` de propósito. Largura fixa de algarismo serve a número em
        coluna, que alinha por casa decimal; num valor grande e solto ela abre
        buracos entre os dígitos. É a mesma regra que a Figura do painel
        financeiro já segue.
      */}
      <p className="mt-2 text-[1.75rem] leading-none font-semibold tracking-[-0.03em] text-ink">
        {loading ? '·' : value}
      </p>
      <p className="mt-2.5 text-xs text-faint">{loading ? 'Carregando…' : detail}</p>
    </Card>
  )
}
