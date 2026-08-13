import { useMemo, useState, type FormEvent } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import { PageHeader } from '@/components/PageHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Controls'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field, MoneyInput, SelectInput, TextInput } from '@/components/ui/Field'
import { Money } from '@/components/ui/Money'
import { transactionsInMonth } from '@/domain/selectors'
import type { Account, AccountKind } from '@/domain/types'
import { formatMonthLong } from '@/lib/date'
import { parseDecimalInput, toCents } from '@/lib/money'
import { useFinanceStore } from '@/store/financeStore'
import { useAccounts, useSelectedMonth, useTransactions } from '@/store/hooks'

const KIND_META: Record<AccountKind, { label: string; icon: IconName }> = {
  checking: { label: 'Conta corrente', icon: 'landmark' },
  credit_card: { label: 'Cartão de crédito', icon: 'credit-card' },
  cash: { label: 'Dinheiro', icon: 'banknote' },
  investment: { label: 'Investimento', icon: 'coins' },
}

export function AccountsPage() {
  const accounts = useAccounts()
  const transactions = useTransactions()
  const month = useSelectedMonth()
  const addAccount = useFinanceStore((state) => state.addAccount)
  const deleteAccount = useFinanceStore((state) => state.deleteAccount)

  const [removing, setRemoving] = useState<Account | null>(null)

  /** Quanto saiu por conta no mês selecionado. */
  const spendByAccount = useMemo(() => {
    const totals = new Map<string, number>()
    for (const transaction of transactionsInMonth(transactions, month)) {
      if (transaction.kind === 'income' || !transaction.accountId) continue
      totals.set(
        transaction.accountId,
        (totals.get(transaction.accountId) ?? 0) + transaction.amountCents,
      )
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
    <>
      <PageHeader
        title="Contas e cartões"
        description="Separe de onde cada gasto saiu. Cadastro manual: a leitura automática do banco ainda não existe."
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-8">
          <Card>
            <CardHeader
              title="Suas contas"
              description={`Movimentação de ${formatMonthLong(month).toLowerCase()}`}
            />
            {accounts.length === 0 ? (
              <EmptyState
                icon="credit-card"
                title="Nenhuma conta cadastrada"
                description="Cadastrar suas contas e cartões permite marcar de onde cada gasto saiu, e é o mesmo cadastro que a sincronização com o banco vai usar quando existir."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-hairline">
                {accounts.map((account) => {
                  const meta = KIND_META[account.kind]
                  const spent = spendByAccount.get(account.id) ?? 0

                  return (
                    <li
                      key={account.id}
                      className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-sunken text-faint">
                          <Icon name={meta.icon} size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[0.8125rem] font-semibold text-ink">
                              {account.name}
                            </span>
                            {account.last4 ? (
                              <span className="tnum shrink-0 font-mono text-xs text-faint">
                                ••{account.last4}
                              </span>
                            ) : null}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {meta.label}
                            {account.institution ? ` · ${account.institution}` : ''}
                            {account.creditCard
                              ? ` · fecha dia ${account.creditCard.closingDay}`
                              : ''}
                          </span>
                        </span>
                      </span>

                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-right">
                          <span className="block text-[0.8125rem]">
                            <Money cents={spent} className="font-medium" />
                          </span>
                          <span className="block text-xs text-muted">no mês</span>
                        </span>
                        <IconButton
                          icon="trash-2"
                          label={`Remover ${account.name}`}
                          size="sm"
                          onClick={() => setRemoving(account)}
                        />
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <SyncRoadmap />
        </div>

        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-6">
            <Card>
              <CardHeader title="Nova conta" />
              <AccountForm onSubmit={addAccount} />
            </Card>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) deleteAccount(removing.id)
        }}
        title="Remover conta"
        message={
          removing
            ? `${removing.name} será removida. Os ${countByAccount.get(removing.id) ?? 0} lançamentos vinculados continuam no histórico, apenas sem conta associada.`
            : ''
        }
        confirmLabel="Remover conta"
      />
    </>
  )
}

/**
 * O que está planejado e o que não existe.
 *
 * O usuário pretende ligar o aplicativo ao banco dele. Enquanto isso não
 * existe, esta seção precisa dizer isso sem rodeio — um painel que insinua
 * integração que não tem é pior que um painel que admite não ter.
 */
function SyncRoadmap() {
  return (
    <Card>
      <CardHeader
        title="Sincronização com o banco"
        action={<Badge tone="quiet">Ainda não disponível</Badge>}
      />
      <p className="max-w-[68ch] text-xs leading-relaxed text-muted">
        O plano é ler compras do cartão, faturas, extrato da conta e posição de investimentos por
        um agregador do Open Finance. Nada disso funciona hoje: o aplicativo não fala com nenhuma
        instituição financeira e todo lançamento é manual.
      </p>
      <p className="mt-2.5 max-w-[68ch] text-xs leading-relaxed text-muted">
        O que já está pronto é a estrutura embaixo: cada lançamento guarda a origem e um espaço
        para o identificador externo que evita duplicar a mesma compra a cada sincronia, e contas
        e cartões existem como entidade própria. Falta a integração em si: o token do agregador
        precisa viver no servidor, nunca no navegador.
      </p>
    </Card>
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
          <SelectInput
            id={id}
            value={kind}
            onChange={(event) => setKind(event.target.value as AccountKind)}
          >
            {Object.entries(KIND_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </SelectInput>
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
