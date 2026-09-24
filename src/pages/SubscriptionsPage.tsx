import { useMemo, useState } from 'react'
import { Icon } from '@/components/Icon'
import { NarrowColumn } from '@/components/NarrowColumn'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ItemRow, MetaDot } from '@/components/ui/ItemRow'
import { Money } from '@/components/ui/Money'
import { Select } from '@/components/ui/Select'
import { categoryColor } from '@/domain/categories'
import {
  activeSubscriptions,
  monthlySubscriptionCost,
  type Subscription,
} from '@/domain/subscriptions'
import type { Account } from '@/domain/types'
import { BankTag } from '@/features/dashboard/BankTag'
import { BrandMark, findBrand } from '@/features/series/BrandMark'
import { SeriesRowMenu } from '@/features/series/SeriesRowMenu'
import { SeriesSummary } from '@/features/series/SeriesSummary'
import { SubscriptionDetails } from '@/features/subscriptions/SubscriptionDetails'
import { TransactionDetails } from '@/features/transactions/TransactionDetails'
import { TransactionForm } from '@/features/transactions/TransactionForm'
import type { Transaction } from '@/domain/types'
import { fromIsoDate } from '@/lib/date'
import { useFinanceStore } from '@/store/financeStore'
import { useAccounts, useCategories, useGoals, useTransactions } from '@/store/hooks'

/** O que vem depois do valor: a unidade do número, e não uma frase. */
const POR_CADENCIA: Record<Subscription['cadence'], string> = {
  weekly: '/semana',
  monthly: '/mês',
  yearly: '/ano',
}

const MES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** "2 Out", como na referência: a próxima cobrança cabe no mês que vem, e o ano seria ruído. */
function diaEMes(iso: string): string {
  const data = fromIsoDate(iso)
  return data ? `${data.getDate()} ${MES_CURTO[data.getMonth()]}` : '—'
}

/**
 * As assinaturas ativas, e o que elas custam.
 *
 * A projeção anual é o número que a página existe para mostrar. O gasto
 * mensal é fácil de aceitar — quarenta reais aqui, vinte ali — e é sobre doze
 * meses que a conta assusta; mostrar os dois lado a lado é o argumento
 * inteiro, e não um enfeite de dashboard.
 *
 * A média por serviço fecha a faixa porque separa dois casos que o total
 * confunde: muitas assinaturas baratas e poucas caras somam igual e pedem
 * decisões opostas.
 */
export function SubscriptionsPage() {
  const transactions = useTransactions()
  const categories = useCategories()
  const accounts = useAccounts()
  const goals = useGoals()
  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const updateTransaction = useFinanceStore((state) => state.updateTransaction)

  const [conta, setConta] = useState<string>('all')
  const [adicionando, setAdicionando] = useState(false)
  // O detalhe guarda o id da série, e não uma cópia da assinatura: ela é
  // derivada do histórico a cada renderização, e um objeto guardado aqui
  // mostraria o valor de antes depois de qualquer edição.
  const [vendoSerie, setVendoSerie] = useState<string | null>(null)
  const [vendoLancamento, setVendoLancamento] = useState<Transaction | null>(null)
  const [editando, setEditando] = useState<Transaction | null>(null)

  const assinaturas = useMemo(
    () => activeSubscriptions(transactions, categories),
    [transactions, categories],
  )
  const mensal = useMemo(() => monthlySubscriptionCost(assinaturas), [assinaturas])

  // O filtro de conta recorta a lista, e não o resumo: ele mora abaixo da
  // faixa de números, e o que está abaixo de um controle é o que ele controla.
  // "Quanto eu gasto com assinatura" continua sendo a resposta de todas.
  const visiveis = conta === 'all' ? assinaturas : assinaturas.filter((item) => item.accountId === conta)
  const contaPorId = useMemo(() => new Map(accounts.map((item) => [item.id, item])), [accounts])

  const emDetalhe = vendoSerie
    ? (assinaturas.find((item) => item.seriesId === vendoSerie) ?? null)
    : null

  return (
    <NarrowColumn>
      {/*
        Sem cabeçalho visível, como na referência: a aba de seção logo acima já
        diz onde se está. O título continua existindo para quem navega por
        cabeçalhos.
      */}
      <h1 className="sr-only">Assinaturas</h1>

      {assinaturas.length === 0 ? (
        <Card>
          <EmptyState
            icon="repeat"
            title="Nenhuma assinatura ativa"
            description="Cadastre um serviço que cobra todo mês, ou importe o extrato do banco: as cobranças que se repetem aparecem aqui sozinhas."
            action={
              <Button size="sm" variant="quiet" icon="plus" onClick={() => setAdicionando(true)}>
                Adicionar assinatura
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <SeriesSummary
            stats={[
              {
                label: 'Assinaturas',
                icon: 'repeat',
                count: assinaturas.length,
                countUnit: assinaturas.length === 1 ? 'ativa' : 'ativas',
              },
              { label: 'Gasto mensal', cents: mensal },
              { label: 'Projeção anual', cents: mensal * 12, tone: 'attention' },
              {
                label: 'Média/serviço',
                cents: Math.round(mensal / assinaturas.length),
                tone: 'income',
              },
            ]}
          />

          <div className="flex flex-wrap items-center justify-end gap-2">
            {accounts.length > 0 ? (
              <Select
                size="sm"
                aria-label="Filtrar por conta"
                value={conta}
                onChange={setConta}
                options={[
                  { value: 'all', label: 'Todas as contas' },
                  ...accounts.map((item) => ({ value: item.id, label: item.name })),
                ]}
              />
            ) : null}
            <Button variant="outline" icon="plus" onClick={() => setAdicionando(true)}>
              Adicionar
            </Button>
          </div>

          {visiveis.length === 0 ? (
            <Card>
              <EmptyState
                icon="list-filter"
                size="sm"
                title="Nenhuma assinatura nesta conta"
                description="As assinaturas desta conta aparecem aqui assim que houver uma cobrança dela."
                action={
                  <Button size="sm" variant="quiet" onClick={() => setConta('all')}>
                    Ver todas as contas
                  </Button>
                }
              />
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {visiveis.map((assinatura) => (
                <li key={assinatura.seriesId}>
                  <LinhaDeAssinatura
                    assinatura={assinatura}
                    conta={assinatura.accountId ? contaPorId.get(assinatura.accountId) : undefined}
                    onAbrir={() => setVendoSerie(assinatura.seriesId)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <SubscriptionDetails
        subscription={emDetalhe}
        transactions={transactions}
        categories={categories}
        goals={goals}
        accounts={accounts}
        onClose={() => setVendoSerie(null)}
        /* Uma cobrança abre como lançamento, e o detalhe da assinatura fecha:
           dois modais empilhados deixam a pessoa sem saber o que o Esc fecha. */
        onOpenTransaction={(lancamento) => {
          setVendoSerie(null)
          setVendoLancamento(lancamento)
        }}
      />

      <TransactionDetails
        transaction={vendoLancamento}
        transactions={transactions}
        categories={categories}
        goals={goals}
        accounts={accounts}
        onClose={() => setVendoLancamento(null)}
        onOpen={setVendoLancamento}
        onEdit={(lancamento) => {
          setVendoLancamento(null)
          setEditando(lancamento)
        }}
      />

      <Dialog
        open={editando !== null}
        onClose={() => setEditando(null)}
        title="Editar cobrança"
      >
        {editando ? (
          <TransactionForm
            categories={categories}
            goals={goals}
            accounts={accounts}
            initial={editando}
            submitLabel="Salvar alterações"
            onCancel={() => setEditando(null)}
            onSubmit={(draft) => {
              updateTransaction(editando.id, draft)
              setEditando(null)
            }}
          />
        ) : null}
      </Dialog>

      <Dialog open={adicionando} onClose={() => setAdicionando(false)} title="Nova assinatura">
        <TransactionForm
          categories={categories}
          goals={goals}
          accounts={accounts}
          preset={{ seriesKind: 'subscription', categoryId: 'assinaturas' }}
          onCancel={() => setAdicionando(false)}
          onSubmit={(draft, recurrence) => {
            addTransaction(draft, recurrence)
            setAdicionando(false)
          }}
        />
      </Dialog>
    </NarrowColumn>
  )
}

/**
 * Uma assinatura: a marca, o nome, quando cobra de novo e de onde sai.
 *
 * Na linha grande, como na referência. Aqui a marca é a leitura principal —
 * reconhecer o quadrado roxo da Vivo é mais rápido que ler "vivo easy vivo
 * easy sao paulo bra" —, e uma pastilha de 36px não dá à arte espaço para ser
 * reconhecida.
 *
 * O menu fica sempre à vista, e não só no hover: "isto não é assinatura" é a
 * correção que a detecção automática mais pede, e ela não pode depender de a
 * pessoa adivinhar que existe um menu escondido.
 *
 * A linha inteira abre o detalhe, e o nome é um botão de verdade por dentro:
 * o botão é o caminho do teclado, e o clique no resto do cartão é conveniência
 * de mouse por cima dele. É o mesmo arranjo da linha de lançamento — uma tela
 * em que a linha abre e a outra em que não abriria seria a pessoa tendo que
 * descobrir a regra duas vezes.
 */
function LinhaDeAssinatura({
  assinatura,
  conta,
  onAbrir,
}: {
  assinatura: Subscription
  conta: Account | undefined
  onAbrir: () => void
}) {
  const marca = findBrand(assinatura.label)
  const nome = marca?.nome ?? assinatura.label

  return (
    <Card
      onClick={onAbrir}
      className="cursor-pointer p-5 transition-colors duration-150 hover:border-hairline-strong sm:p-6"
    >
      <ItemRow
        size="lg"
        className="py-0"
        media={
          /*
            A arte da marca quando o serviço é conhecido, e a pastilha da
            categoria quando não é. As duas ocupam o mesmo quadrado, então a
            lista continua alinhada com marcas de origens diferentes.
          */
          <BrandMark
            label={assinatura.label}
            fallbackIcon={assinatura.icon}
            fallbackColor={categoryColor(assinatura.categoryId)}
            size={70}
            className="rounded-lg"
          />
        }
        title={
          <button
            type="button"
            onClick={(evento) => {
              // O cartão também abre; sem isto, abriria duas vezes.
              evento.stopPropagation()
              onAbrir()
            }}
            className="max-w-full truncate text-left hover:underline"
          >
            {nome}
          </button>
        }
        // O texto cru do banco, só quando o título virou marca. É por ele que
        // a pessoa confere, na fatura, que a cobrança é mesmo aquela.
        subtitle={marca ? assinatura.label : undefined}
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <Icon name="calendar" size={14} className="shrink-0" />
              Próximo: {diaEMes(assinatura.next)}
            </span>
            <MetaDot />
            <span>
              {assinatura.charged} {assinatura.charged === 1 ? 'pagamento' : 'pagamentos'}
            </span>
            {conta ? (
              <>
                <MetaDot />
                <BankTag account={conta} size="sm" />
              </>
            ) : null}
          </>
        }
        value={<Money cents={assinatura.amountCents} />}
        caption={POR_CADENCIA[assinatura.cadence]}
        trailing={
          // O menu não abre o detalhe: o clique nele, e nos itens dele, para
          // aqui em vez de subir até o cartão.
          <div className="-mt-1 -mr-2" onClick={(evento) => evento.stopPropagation()}>
            <SeriesRowMenu
              seriesId={assinatura.seriesId}
              label={nome}
              kind="subscription"
              charges={assinatura.occurrences}
            />
          </div>
        }
      />
    </Card>
  )
}
