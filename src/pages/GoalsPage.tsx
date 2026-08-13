import { useMemo, useState, type FormEvent } from 'react'
import { Icon, GOAL_ICON_OPTIONS } from '@/components/Icon'
import { PageHeader } from '@/components/PageHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, Progress } from '@/components/ui/Controls'
import { Donut } from '@/components/ui/Donut'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field, MoneyInput, SelectInput, TextInput } from '@/components/ui/Field'
import { Money } from '@/components/ui/Money'
import { goalProgress } from '@/domain/selectors'
import type { Goal } from '@/domain/types'
import { parseDecimalInput, percentOf, toCents, toInputValue } from '@/lib/money'
import { useFinanceStore } from '@/store/financeStore'
import { useGoals, useTransactions } from '@/store/hooks'

export function GoalsPage() {
  const goals = useGoals()
  const transactions = useTransactions()
  const addGoal = useFinanceStore((state) => state.addGoal)
  const updateGoal = useFinanceStore((state) => state.updateGoal)
  const deleteGoal = useFinanceStore((state) => state.deleteGoal)

  const [editing, setEditing] = useState<Goal | null>(null)
  const [removing, setRemoving] = useState<Goal | null>(null)

  const rows = useMemo(() => goalProgress(goals, transactions), [goals, transactions])

  const contributionCount = (goalId: string) =>
    transactions.filter((item) => item.kind === 'contribution' && item.goalId === goalId).length

  const totalSaved = rows.reduce((sum, row) => sum + row.savedCents, 0)
  const totalTarget = rows.reduce((sum, row) => sum + row.goal.targetCents, 0)
  const overallPercent = percentOf(totalSaved, totalTarget)
  const reachedCount = rows.filter((row) => row.reached).length
  const allReached = rows.length > 0 && reachedCount === rows.length

  return (
    <>
      <PageHeader
        title="Metas"
        description="O progresso vem sempre da soma dos aportes, nunca de um valor digitado à mão."
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Card>
            <CardHeader title="Suas metas" />
            {rows.length === 0 ? (
              <EmptyState
                icon="target"
                title="Nenhuma meta ainda"
                description="Uma meta é um destino para a sobra do mês. Crie uma ao lado e depois registre aportes na tela de transações; o progresso se atualiza sozinho."
              />
            ) : (
              <>
                {/*
                  A visão de conjunto que nenhuma meta isolada mostra: quanto
                  já foi guardado contra a soma de todos os alvos. Mesma
                  composição do "Meta em foco" do Painel — anel à esquerda,
                  valor e legenda à direita — porque é a mesma pergunta, só que
                  somada em vez de recortada numa meta só.
                */}
                <div className="mb-6 flex items-center gap-5 border-b border-hairline pb-6">
                  <Donut
                    value={Math.min(overallPercent, 100)}
                    rawValue={overallPercent}
                    label={`Progresso geral: ${overallPercent}% das metas`}
                    tone="income"
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-muted">Guardado no total</p>
                    <p className="mt-1.5 text-lg font-semibold">
                      <Money cents={totalSaved} tabular={false} />
                    </p>
                    <p className="mt-3 text-xs text-muted">
                      {reachedCount > 0 ? (
                        <>
                          {reachedCount} {reachedCount === 1 ? 'meta concluída' : 'metas concluídas'}
                          {allReached ? '' : ' · '}
                        </>
                      ) : null}
                      {allReached ? null : (
                        <>
                          Faltam{' '}
                          <Money
                            cents={Math.max(totalTarget - totalSaved, 0)}
                            emphasis="strong"
                          />
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <ul className="flex flex-col divide-y divide-hairline">
                  {rows.map((row) => (
                    <li
                      key={row.goal.id}
                      className="-mx-3 rounded-md px-3 py-4 transition-colors duration-150 hover:bg-sunken/60"
                    >
                      <div className="mb-2.5 flex items-start justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            className={
                              row.reached
                                ? 'inline-flex size-10 shrink-0 items-center justify-center rounded-sm bg-block text-block-ink'
                                : 'inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-sunken text-faint'
                            }
                          >
                            <Icon name={row.goal.icon} size={17} />
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-base font-semibold text-ink">
                                {row.goal.name}
                              </span>
                              {row.reached ? (
                                <Badge tone="outline" icon="check">
                                  Concluída
                                </Badge>
                              ) : null}
                            </span>
                            <span className="block text-xs text-muted">
                              {contributionCount(row.goal.id)}{' '}
                              {contributionCount(row.goal.id) === 1 ? 'aporte' : 'aportes'}
                            </span>
                          </span>
                        </span>

                        <span className="flex shrink-0 items-center gap-0.5">
                          <IconButton
                            icon="square-pen"
                            label={`Editar ${row.goal.name}`}
                            size="sm"
                            onClick={() => setEditing(row.goal)}
                          />
                          <IconButton
                            icon="trash-2"
                            label={`Excluir ${row.goal.name}`}
                            size="sm"
                            onClick={() => setRemoving(row.goal)}
                          />
                        </span>
                      </div>

                      <Progress
                        value={row.percent}
                        overflow={row.rawPercent}
                        label={`${row.goal.name}: ${row.rawPercent}% da meta`}
                        tone="income"
                      />

                      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
                        <span className="text-muted">
                          <Money cents={row.savedCents} className="font-medium text-ink" /> de{' '}
                          <Money cents={row.goal.targetCents} />
                        </span>
                        <span className="text-muted">
                          {row.reached ? (
                            'Meta atingida'
                          ) : (
                            <>
                              Faltam{' '}
                              <Money cents={row.remainingCents} className="font-medium text-ink" />
                            </>
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>

        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-6">
            <Card>
              <CardHeader
                title="Nova meta"
                description="Defina o alvo; o quanto já foi guardado vem dos aportes."
              />
              <GoalForm
                onSubmit={(values) => addGoal(values)}
                submitLabel="Criar meta"
              />
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title="Editar meta">
        {editing ? (
          <GoalForm
            initial={editing}
            submitLabel="Salvar alterações"
            onCancel={() => setEditing(null)}
            onSubmit={(values) => {
              updateGoal(editing.id, values)
              setEditing(null)
            }}
          />
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) deleteGoal(removing.id)
        }}
        title="Excluir meta"
        message={
          removing
            ? `"${removing.name}" e os ${contributionCount(removing.id)} aportes feitos para ela serão removidos. Os valores voltam a contar como saldo disponível nos meses em que foram lançados.`
            : ''
        }
        confirmLabel="Excluir meta e aportes"
      />
    </>
  )
}

interface GoalFormValues {
  name: string
  icon: string
  targetCents: number
  deadline: string | null
}

function GoalForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: Goal
  onSubmit: (values: GoalFormValues) => void
  onCancel?: () => void
  submitLabel: string
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? 'target')
  const [target, setTarget] = useState(initial ? toInputValue(initial.targetCents) : '')
  const [errors, setErrors] = useState<{ name?: string; target?: string }>({})

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next: typeof errors = {}
    const parsed = parseDecimalInput(target)

    if (!name.trim()) next.name = 'Dê um nome para reconhecer a meta.'
    if (!Number.isFinite(parsed) || parsed <= 0) next.target = 'Informe o valor que quer juntar.'

    setErrors(next)
    if (Object.keys(next).length > 0) return

    onSubmit({ name: name.trim(), icon, targetCents: toCents(parsed), deadline: null })

    if (!initial) {
      setName('')
      setTarget('')
      setIcon('target')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Nome" error={errors.name}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            value={name}
            placeholder="Reserva de emergência, viagem…"
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </Field>

      <Field label="Valor alvo" error={errors.target}>
        {({ id, describedBy, invalid }) => (
          <MoneyInput
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        )}
      </Field>

      <Field label="Ícone">
        {({ id }) => (
          <div className="flex items-center gap-2">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-sunken text-faint">
              <Icon name={icon} size={17} />
            </span>
            <SelectInput
              id={id}
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              className="flex-1"
            >
              {GOAL_ICON_OPTIONS.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </div>
        )}
      </Field>

      <div className="flex gap-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} block>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" block icon={initial ? 'check' : 'plus'}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
