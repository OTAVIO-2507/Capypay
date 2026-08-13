import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ColumnChart } from '@/features/admin/ColumnChart'
import { DonutChart } from '@/features/admin/DonutChart'
import { HeatmapChart } from '@/features/admin/HeatmapChart'
import { StepAreaChart } from '@/features/admin/StepAreaChart'
import {
  acoesPorDia,
  acumuladoPorMes,
  composicaoDeContas,
  criacoesPorMes,
  criadasDesde,
  mediaPorMes,
  summarizeUsers,
  taxaDeAtivacao,
} from '@/features/admin/adminMetrics'
import { exportUsersCsv } from '@/features/admin/exportUsersCsv'
import { useAdminAudit } from '@/features/admin/useAdminAudit'
import { useAdminUsers } from '@/features/admin/useAdminUsers'

/**
 * O relatório da plataforma: ritmo, tamanho, composição e o que foi feito.
 *
 * A divisão de trabalho com o Painel é deliberada. O Painel responde "como
 * estamos agora" e por isso é operacional: pastilhas, pendências, últimos
 * acessos. Esta página responde "como chegamos aqui", e por isso é toda de
 * série e proporção. Repetir aqui as pastilhas de lá seria ocupar espaço com
 * uma resposta que a pessoa acabou de ler.
 *
 * Os quatro gráficos existem porque são quatro perguntas, não porque quatro
 * enche melhor a tela: ritmo (quantas por mês), tamanho (quantas existem),
 * composição (quem são) e atividade administrativa (o que foi feito com elas).
 */
/** Doze semanas cabem na largura de meio cartão sem rolagem em telas largas. */
const SEMANAS_NO_CALENDARIO = 12

export function AdminReportsPage() {
  const { users, loading, error, reload } = useAdminUsers()
  const { entries, loading: carregandoHistorico } = useAdminAudit()

  const lista = users ?? []
  const agora = Date.now()
  const resumo = summarizeUsers(lista, agora)
  const meses = criacoesPorMes(lista, agora)
  const acumulado = acumuladoPorMes(meses)
  const ativacao = taxaDeAtivacao(lista)
  const historico = entries ?? []
  const dias = acoesPorDia(historico, agora, SEMANAS_NO_CALENDARIO)

  if (error) {
    return (
      <>
        <PageHeader title="Relatórios" description="Números por período e exportação." />
        <Card>
          <EmptyState
            icon="triangle-alert"
            title="Não foi possível carregar as contas"
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

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Ritmo, composição e histórico. Nenhum dado financeiro passa por aqui."
        actions={
          <>
            <Button variant="quiet" icon="repeat" onClick={() => void reload()}>
              Atualizar
            </Button>
            <Button
              icon="download"
              disabled={loading || lista.length === 0}
              onClick={() => exportUsersCsv(lista)}
            >
              Exportar contas
            </Button>
          </>
        }
      />

      {/*
        Quatro números de relatório, e não os do Painel de novo: aqui interessa
        o acumulado, o ritmo recente, a taxa de ativação e a média mensal. Lá
        interessa o que precisa de ação hoje.
      */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Numero
          icon="users"
          rotulo="Contas no total"
          valor={String(resumo.total)}
          detalhe={`${resumo.regulares} de uso, ${resumo.admins} de administração`}
          loading={loading}
        />
        <Numero
          icon="user-plus"
          rotulo="Criadas em 30 dias"
          valor={String(criadasDesde(lista, agora, 30))}
          detalhe={meses.length > 0 ? `Série desde ${meses[0].label}` : 'Nenhuma conta ainda'}
          loading={loading}
        />
        <Numero
          icon="user-check"
          rotulo="Já acessaram"
          valor={`${ativacao.percentual}%`}
          detalhe={`${ativacao.acessaram} de ${ativacao.total} entraram ao menos uma vez`}
          loading={loading}
        />
        <Numero
          icon="chart-column"
          rotulo="Média por mês"
          valor={mediaPorMes(meses).toLocaleString('pt-BR')}
          detalhe={
            meses.length > 0
              ? `Ao longo de ${meses.length} ${meses.length === 1 ? 'mês' : 'meses'}`
              : 'Sem série ainda'
          }
          loading={loading}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Painel
          titulo="Contas criadas por mês"
          descricao="O ritmo de entrada, mês a mês"
          loading={loading}
          vazio={meses.length === 0}
          iconeVazio="chart-column"
          textoVazio="O gráfico aparece a partir do primeiro cadastro."
        >
          {/*
            Os meses sem cadastro entram como coluna vazia: pular período
            encosta dois momentos distantes lado a lado e mente sobre o
            intervalo.
          */}
          <ColumnChart
            unidade="contas"
            colunas={meses.map((mes) => ({ id: mes.month, label: mes.label, count: mes.count }))}
          />
        </Painel>

        <Painel
          titulo="Total acumulado"
          descricao="Quantas contas existiam ao fim de cada mês"
          loading={loading}
          vazio={acumulado.length === 0}
          iconeVazio="trending-up"
          textoVazio="A série aparece a partir do primeiro cadastro."
        >
          <StepAreaChart
            unidade={{ singular: 'conta', plural: 'contas' }}
            pontos={acumulado.map((mes) => ({
              id: mes.month,
              label: mes.label,
              count: mes.count,
            }))}
          />
        </Painel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Painel
          titulo="Composição das contas"
          descricao="Por papel e por situação"
          loading={loading}
          vazio={resumo.total === 0}
          iconeVazio="users"
          textoVazio="O disco aparece com o primeiro cadastro."
        >
          <DonutChart total={resumo.total} slices={composicaoDeContas(lista)} />
        </Painel>

        <Painel
          titulo="Atividade administrativa"
          descricao={`Ações por dia nas últimas ${SEMANAS_NO_CALENDARIO} semanas`}
          loading={carregandoHistorico}
          vazio={historico.length === 0}
          iconeVazio="list-filter"
          textoVazio="Nenhuma ação registrada até agora."
        >
          {/*
            Calendário, e não disco: o histórico responde melhor a "quando" do
            que a "de que tipo", e o tipo já é o que a Auditoria filtra. Aqui a
            posição é a data e a intensidade é a contagem, sem gastar eixo
            nenhum com isso.
          */}
          <HeatmapChart dias={dias} />
        </Painel>
      </div>

      <Card className="mt-5">
        <CardHeader title="Exportação" description="O que sai no arquivo" />
        <p className="text-xs leading-relaxed text-muted">
          O CSV traz e-mail, papel, situação, data de criação e último acesso, com separador
          ponto-e-vírgula e BOM UTF-8, pronto para o Excel em português. Não traz lançamento, saldo
          nem meta de ninguém: esse dado não chega a este painel, e um download não seria a exceção.
        </p>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-faint">
          <Icon name="circle-alert" size={13} />O arquivo contém e-mails. Trate como dado pessoal.
        </p>
      </Card>
    </>
  )
}

/**
 * A moldura repetida dos quatro gráficos.
 *
 * Carregando, vazio e pronto são três estados que todo painel desta página
 * tem, e escrevê-los quatro vezes é como eles começam a divergir: um ganha
 * mensagem melhor, outro esquece o estado vazio.
 */
function Painel({
  titulo,
  descricao,
  loading,
  vazio,
  iconeVazio,
  textoVazio,
  children,
}: {
  titulo: string
  descricao: string
  loading: boolean
  vazio: boolean
  iconeVazio: IconName
  textoVazio: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader title={titulo} description={descricao} />
      {loading ? (
        <p className="text-[0.8125rem] text-muted">Carregando…</p>
      ) : vazio ? (
        <EmptyState icon={iconeVazio} size="sm" title="Nada para mostrar" description={textoVazio} />
      ) : (
        children
      )}
    </Card>
  )
}

function Numero({
  icon,
  rotulo,
  valor,
  detalhe,
  loading,
}: {
  icon: IconName
  rotulo: string
  valor: string
  detalhe: string
  loading: boolean
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted">{rotulo}</p>
        <Icon name={icon} size={16} className="text-faint" />
      </div>
      <p className="mt-2 text-[1.75rem] leading-none font-semibold tracking-[-0.03em] text-ink">
        {loading ? '·' : valor}
      </p>
      <p className="mt-2.5 text-xs text-faint">{loading ? 'Carregando…' : detalhe}</p>
    </Card>
  )
}
