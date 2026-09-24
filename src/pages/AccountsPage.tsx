import { useMemo, useState, type FormEvent } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import { NarrowColumn } from '@/components/NarrowColumn'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader, NoticePanel } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field, MoneyInput, TextInput } from '@/components/ui/Field'
import { ItemMedia, ItemRow } from '@/components/ui/ItemRow'
import { Money } from '@/components/ui/Money'
import { Select } from '@/components/ui/Select'
import { cardSummary, currentInvoiceMonth } from '@/domain/invoices'
import { transactionsInMonth } from '@/domain/selectors'
import type { Account, AccountKind } from '@/domain/types'
import { CardTile } from '@/features/accounts/CardTile'
import { InvoiceDrawer } from '@/features/accounts/InvoiceDrawer'
import { InvoiceHistory } from '@/features/accounts/InvoiceHistory'
import { findBankBrand } from '@/features/dashboard/bankBrand'
import { ConnectBankButton } from '@/features/openfinance/ConnectBankButton'
import { formatMonthLong, fromIsoDate, todayIso } from '@/lib/date'
import { parseDecimalInput, toCents } from '@/lib/money'
import { useFinanceStore } from '@/store/financeStore'
import {
  useAccounts,
  useCategories,
  useGoals,
  useSelectedMonth,
  useTransactions,
} from '@/store/hooks'

const KIND_META: Record<AccountKind, { label: string; icon: IconName }> = {
  checking: { label: 'Conta corrente', icon: 'landmark' },
  credit_card: { label: 'Cartão de crédito', icon: 'credit-card' },
  cash: { label: 'Dinheiro', icon: 'banknote' },
  investment: { label: 'Investimento', icon: 'coins' },
}

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/**
 * Contas: os cartões na frente, como no produto de referência, e as demais
 * contas embaixo.
 *
 * A tela abre pela fatura, que é a pergunta mais frequente sobre dinheiro que
 * ainda não saiu: quanto vai vencer, e quando. Depois vêm os cartões um a um,
 * com o limite tomado, e as faturas anteriores para comparação. Contas
 * correntes, dinheiro e investimento — que não têm fatura — ficam numa lista
 * própria no fim, com o cadastro manual e a conexão com o banco.
 *
 * O cartão desenhado que já ocupou esta tela saiu: ele respondia "de qual
 * cartão estamos falando", e o cartão da lista responde o mesmo com o logo e o
 * final do número, dizendo também quanto ele deve.
 */
export function AccountsPage() {
  const accounts = useAccounts()
  const transactions = useTransactions()
  const categories = useCategories()
  const goals = useGoals()
  const month = useSelectedMonth()
  const addAccount = useFinanceStore((state) => state.addAccount)
  const deleteAccount = useFinanceStore((state) => state.deleteAccount)

  const [removing, setRemoving] = useState<Account | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  // O painel guarda o id do cartão, e não o resumo: lido a cada renderização,
  // ele acompanha uma sincronização que chegue com o painel aberto.
  const [detalheId, setDetalheId] = useState<string | null>(null)

  const hoje = todayIso()
  const ativas = accounts.filter((account) => !account.archived)
  const cartoes = ativas.filter((account) => account.kind === 'credit_card')
  const outras = ativas.filter((account) => account.kind !== 'credit_card')

  /*
   * O banco reconhecido em qualquer conta serve para todas. O cartão importado
   * costuma se chamar "GOLD", com a instituição chegando como "MeuPluggy" — o
   * proxy da conexão, não o banco. É da conta corrente da mesma conexão, que
   * vem como "BANCO INTER", que sai o nome.
   */
  const bancoDasContas =
    ativas.map((account) => findBankBrand(account.name, account.institution)).find(Boolean) ?? null

  const resumos = useMemo(
    () => cartoes.map((cartao) => cardSummary(cartao, transactions, hoje)),
    [cartoes, transactions, hoje],
  )
  const faturaAtual = resumos.reduce((soma, resumo) => soma + resumo.invoiceCents, 0)
  // O gráfico começa na fatura aberta mais adiantada entre os cartões: com
  // fechamentos diferentes, um pode já estar na fatura de novembro enquanto o
  // outro ainda está na de outubro.
  const mesDaFaturaAberta = resumos
    .map((resumo) => currentInvoiceMonth(resumo.account.creditCard, hoje))
    .sort()
    .at(-1)

  // A data até onde os dados dos cartões sincronizados chegam, para o aviso.
  const ultimaSincronizada = resumos
    .filter((resumo) => resumo.account.sync)
    .map((resumo) => resumo.lastTransactionDate)
    .filter((data): data is string => Boolean(data))
    .sort()
    .at(-1)
  const ultimaData = ultimaSincronizada ? fromIsoDate(ultimaSincronizada) : null

  /** Quanto saiu por conta no mês selecionado — para as contas sem fatura. */
  const spendByAccount = useMemo(() => {
    const totals = new Map<string, number>()
    for (const transaction of transactionsInMonth(transactions, month)) {
      if (transaction.kind === 'income' || !transaction.accountId) continue
      totals.set(transaction.accountId, (totals.get(transaction.accountId) ?? 0) + transaction.amountCents)
    }
    return totals
  }, [transactions, month])

  const countByAccount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const transaction of transactions) {
      if (!transaction.accountId) continue
      counts.set(transaction.accountId, (counts.get(transaction.accountId) ?? 0) + 1)
    }
    return counts
  }, [transactions])

  return (
    <NarrowColumn width="lg">
      <h1 className="sr-only">Contas</h1>

      {cartoes.length > 0 ? (
        <section
          aria-label="Fatura atual"
          className="mb-6 rounded-lg border border-hairline bg-[linear-gradient(120deg,var(--sunken),var(--sheet)_65%)] px-6 py-9 text-center"
        >
          <p className="flex items-center justify-center gap-1.5 text-[0.8125rem] text-muted">
            <Icon name="banknote" size={14} />
            Fatura atual
          </p>
          <Money cents={faturaAtual} className="mt-1 block text-5xl leading-tight font-bold tracking-tight" />
          {cartoes.length > 1 ? (
            <p className="mt-1 text-xs text-muted">somando {cartoes.length} cartões</p>
          ) : null}
        </section>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[0.9375rem] font-semibold text-ink">
          <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-md bg-sunken text-muted">
            <Icon name="credit-card" size={16} />
          </span>
          Seus cartões
          <span className="tnum text-xs font-normal text-muted">({cartoes.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          <ConnectBankButton />
          <Button variant="outline" icon="plus" onClick={() => setAdicionando(true)}>
            Adicionar
          </Button>
        </div>
      </div>

      {cartoes.length === 0 ? (
        <Card className="mb-6">
          <EmptyState
            icon="credit-card"
            title="Nenhum cartão ainda"
            description="Conecte o banco para trazer os cartões com limite e fatura, ou cadastre um à mão com o dia de fechamento e de vencimento."
          />
        </Card>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {resumos.map((resumo) => (
              <li key={resumo.account.id}>
                <CardTile
                  summary={resumo}
                  fallbackBank={bancoDasContas}
                  onRemove={() => setRemoving(resumo.account)}
                  onOpenDetails={() => setDetalheId(resumo.account.id)}
                />
              </li>
            ))}
          </ul>

          <NoticePanel tone="attention" className="mt-4 flex items-start gap-2.5 px-4 py-3 text-xs leading-relaxed">
            <Icon name="info" size={14} className="mt-0.5 shrink-0" />
            <p>
              {ultimaData
                ? `Fatura estimada. Compras após ${String(ultimaData.getDate()).padStart(2, '0')}/${MES[ultimaData.getMonth()]}/${ultimaData.getFullYear()} podem levar 1–3 dias para aparecer via Open Finance. O app do banco pode mostrar um valor maior.`
                : 'Fatura estimada pela soma das compras lançadas em cada cartão entre um fechamento e o próximo. O valor cobrado pelo banco pode ser diferente.'}
            </p>
          </NoticePanel>

          <div className="mt-6">
            <InvoiceHistory
              cards={cartoes}
              transactions={transactions}
              currentMonth={mesDaFaturaAberta ?? hoje.slice(0, 7)}
            />
          </div>
        </>
      )}

      {/*
        As contas sem fatura: corrente, dinheiro, investimento. Continuam
        aqui, e não numa aba própria, porque são o mesmo cadastro — e o mesmo
        botão de conectar o banco traz as duas coisas juntas.
      */}
      <Card className="mt-6">
        <CardHeader title="Outras contas" description={`Movimentação de ${formatMonthLong(month).toLowerCase()}`} />
        {outras.length === 0 ? (
          <EmptyState
            icon="landmark"
            size="sm"
            title="Nenhuma conta além dos cartões"
            description="Conta corrente, dinheiro e investimento entram aqui, cadastrados à mão ou trazidos pela conexão com o banco."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {outras.map((account) => {
              const meta = KIND_META[account.kind]
              const spent = spendByAccount.get(account.id) ?? 0
              const banco = findBankBrand(account.name, account.institution)

              return (
                <li key={account.id}>
                  <ItemRow
                    media={
                      <ItemMedia size={40} tint={banco?.cor} ink={banco?.tinta}>
                        {banco ? (
                          <span className="text-xs font-bold">{banco.nome.slice(0, 2).toUpperCase()}</span>
                        ) : (
                          <Icon name={meta.icon} size={17} />
                        )}
                      </ItemMedia>
                    }
                    title={account.name}
                    meta={
                      <>
                        {meta.label}
                        {account.institution ? ` · ${account.institution}` : ''}
                      </>
                    }
                    /*
                      O saldo informado pelo banco tem precedência sobre o
                      gasto do mês, quando existe: é o número que a pessoa foi
                      conferir. Ele não entra no saldo do painel, que soma
                      lançamentos — são duas perguntas diferentes.
                    */
                    value={<Money cents={account.balanceCents ?? spent} />}
                    caption={account.balanceCents == null ? 'no mês' : 'no banco'}
                    actions={
                      <IconButton
                        icon="trash-2"
                        label={`Remover ${account.name}`}
                        size="sm"
                        onClick={() => setRemoving(account)}
                      />
                    }
                  />
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <InvoiceDrawer
        summary={resumos.find((resumo) => resumo.account.id === detalheId) ?? null}
        bank={(() => {
          const aberto = resumos.find((resumo) => resumo.account.id === detalheId)?.account
          return aberto ? (findBankBrand(aberto.name, aberto.institution) ?? bancoDasContas) : null
        })()}
        transactions={transactions}
        categories={categories}
        goals={goals}
        onClose={() => setDetalheId(null)}
      />

      <Dialog open={adicionando} onClose={() => setAdicionando(false)} title="Nova conta ou cartão">
        <AccountForm
          onSubmit={(account) => {
            addAccount(account)
            setAdicionando(false)
          }}
        />
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) deleteAccount(removing.id)
        }}
        title={removing?.kind === 'credit_card' ? 'Remover cartão' : 'Remover conta'}
        message={
          removing
            ? `${removing.name} será removido. Os ${countByAccount.get(removing.id) ?? 0} lançamentos vinculados continuam no histórico, apenas sem conta associada.`
            : ''
        }
        confirmLabel={removing?.kind === 'credit_card' ? 'Remover cartão' : 'Remover conta'}
      />
    </NarrowColumn>
  )
}

function AccountForm({
  onSubmit,
}: {
  onSubmit: (account: Omit<Account, 'id' | 'createdAt' | 'archived'>) => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AccountKind>('credit_card')
  const [institution, setInstitution] = useState('')
  const [last4, setLast4] = useState('')
  const [closingDay, setClosingDay] = useState('28')
  const [dueDay, setDueDay] = useState('8')
  const [limit, setLimit] = useState('')
  const [error, setError] = useState<string | undefined>()

  const isCard = kind === 'credit_card'

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Dê um nome para reconhecer a conta.')
      return
    }
    setError(undefined)

    const parsedLimit = parseDecimalInput(limit)

    onSubmit({
      name: name.trim(),
      kind,
      institution: institution.trim() || null,
      last4: last4.trim() || null,
      creditCard: isCard
        ? {
            closingDay: clampDay(closingDay, 28),
            dueDay: clampDay(dueDay, 8),
            limitCents: Number.isFinite(parsedLimit) && parsedLimit > 0 ? toCents(parsedLimit) : null,
          }
        : null,
      sync: null,
    })

    setName('')
    setInstitution('')
    setLast4('')
    setLimit('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Nome" error={error}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            value={name}
            placeholder="Cartão principal, conta salário…"
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </Field>

      <Field label="Tipo">
        {({ id }) => (
          <Select
            id={id}
            value={kind}
            onChange={(value) => setKind(value as AccountKind)}
            options={Object.entries(KIND_META).map(([value, meta]) => ({
              value,
              label: meta.label,
            }))}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Instituição">
          {({ id }) => (
            <TextInput
              id={id}
              value={institution}
              placeholder="Opcional"
              onChange={(event) => setInstitution(event.target.value)}
            />
          )}
        </Field>
        <Field label="Final">
          {({ id }) => (
            <TextInput
              id={id}
              value={last4}
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              onChange={(event) => setLast4(event.target.value.replace(/\D/g, ''))}
            />
          )}
        </Field>
      </div>

      {isCard ? (
        <div className="flex flex-col gap-3 rounded-md bg-sunken p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha no dia">
              {({ id }) => (
                <TextInput
                  id={id}
                  type="number"
                  min={1}
                  max={31}
                  value={closingDay}
                  onChange={(event) => setClosingDay(event.target.value)}
                  className="bg-sheet"
                />
              )}
            </Field>
            <Field label="Vence no dia">
              {({ id }) => (
                <TextInput
                  id={id}
                  type="number"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(event) => setDueDay(event.target.value)}
                  className="bg-sheet"
                />
              )}
            </Field>
          </div>
          <Field label="Limite" hint="Opcional.">
            {({ id, describedBy }) => (
              <MoneyInput
                id={id}
                aria-describedby={describedBy}
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                className="bg-sheet"
              />
            )}
          </Field>
        </div>
      ) : null}

      <Button type="submit" block icon="plus">
        Adicionar conta
      </Button>
    </form>
  )
}

function clampDay(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, 1), 31)
}
