import { useEffect, useState, type FormEvent } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { Segmented, Toggle, type SegmentOption } from '@/components/ui/Controls'
import { Field, MoneyInput, SelectInput, TextInput } from '@/components/ui/Field'
import { categoriesFor, CONTRIBUTION_CATEGORY_ID } from '@/domain/categories'
import type {
  Account,
  Category,
  Goal,
  RecurrenceDraft, RecurrenceFrequency,
  SeriesKind,
  Transaction,
  TransactionDraft,
  TransactionKind,
} from '@/domain/types'
import { cn } from '@/lib/cn'
import { isValidIsoDate, todayIso } from '@/lib/date'
import { parseDecimalInput, toCents, toInputValue } from '@/lib/money'

const KIND_OPTIONS: readonly SegmentOption<TransactionKind>[] = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
  { value: 'contribution', label: 'Aporte' },
]

/**
 * As duas coisas que repetir um lançamento pode criar. A dica embaixo existe
 * porque os nomes sozinhos não separam: "parcela" é palavra que o brasileiro
 * usa para as duas, e é o total fechado que distingue uma da outra.
 */
const SERIES_KIND_OPTIONS: {
  value: SeriesKind
  label: string
  icon: IconName
  hint: string
}[] = [
  {
    value: 'installment',
    label: 'Parcelamento',
    icon: 'credit-card',
    hint: 'Uma compra fatiada, com total fechado. Aparece em Parcelamentos.',
  },
  {
    value: 'subscription',
    label: 'Assinatura',
    icon: 'repeat',
    hint: 'Um serviço que cobra de novo, sem fim previsto. Aparece em Assinaturas.',
  },
]

const FREQUENCY_LABEL: Record<RecurrenceFrequency, string> = {
  monthly: 'Todo mês',
  weekly: 'Toda semana',
  yearly: 'Todo ano',
}

interface TransactionFormProps {
  categories: readonly Category[]
  goals: readonly Goal[]
  accounts: readonly Account[]
  /** Preenchido para edição; ausente para criação. */
  initial?: Transaction
  onSubmit: (draft: TransactionDraft, recurrence: RecurrenceDraft | null) => void
  onCancel?: () => void
  submitLabel?: string
}

interface FormErrors {
  amount?: string
  description?: string
  date?: string
  goal?: string
  occurrences?: string
}

export function TransactionForm({
  categories,
  goals,
  accounts,
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Registrar lançamento',
}: TransactionFormProps) {
  const isEditing = Boolean(initial)
  const activeGoals = goals.filter((goal) => !goal.archived)

  const [kind, setKind] = useState<TransactionKind>(initial?.kind ?? 'expense')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [amount, setAmount] = useState(initial ? toInputValue(initial.amountCents) : '')
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? 'alimentacao')
  const [goalId, setGoalId] = useState(initial?.goalId ?? activeGoals[0]?.id ?? '')
  const [accountId, setAccountId] = useState(initial?.accountId ?? '')
  const [recurring, setRecurring] = useState(false)
  const [occurrences, setOccurrences] = useState('12')
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly')
  const [seriesKind, setSeriesKind] = useState<SeriesKind>('installment')
  const [errors, setErrors] = useState<FormErrors>({})

  const availableCategories = categoriesFor(categories, kind)

  /**
   * Trocar o tipo pode invalidar a categoria escolhida — "Salário" não existe
   * em despesa. Reapontar para a primeira válida evita enviar um lançamento com
   * categoria que a própria lista não oferece.
   */
  useEffect(() => {
    if (kind === 'contribution') return
    if (!availableCategories.some((category) => category.id === categoryId)) {
      setCategoryId(availableCategories[0]?.id ?? 'outros')
    }
  }, [kind, categoryId, availableCategories])

  const isContribution = kind === 'contribution'
  const noGoals = isContribution && activeGoals.length === 0

  function validate(): FormErrors {
    const next: FormErrors = {}
    const parsed = parseDecimalInput(amount)

    if (!Number.isFinite(parsed) || parsed <= 0) {
      next.amount = 'Informe um valor maior que zero.'
    }
    if (!isContribution && !description.trim()) {
      next.description = 'Descreva o lançamento para reconhecê-lo depois.'
    }
    // Data vazia ou impossível não pode chegar ao armazenamento: é a entrada
    // que, gravada, quebrava a formatação em toda tela que exibisse a linha.
    if (!isValidIsoDate(date)) {
      next.date = 'Escolha uma data válida.'
    }
    if (isContribution && !goalId) {
      next.goal = 'Escolha para qual meta vai o aporte.'
    }
    if (recurring) {
      const count = Number.parseInt(occurrences, 10)
      if (!Number.isFinite(count) || count < 2) {
        next.occurrences = 'Use 2 ou mais repetições.'
      } else if (count > 120) {
        next.occurrences = 'O limite é 120 repetições.'
      }
    }
    return next
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const goal = activeGoals.find((item) => item.id === goalId)

    onSubmit(
      {
        kind,
        description: isContribution
          ? `Aporte · ${goal?.name ?? 'meta'}`
          : description.trim(),
        amountCents: toCents(parseDecimalInput(amount)),
        date,
        categoryId: isContribution ? CONTRIBUTION_CATEGORY_ID : categoryId,
        goalId: isContribution ? goalId : null,
        accountId: accountId || null,
        externalId: null,
        seriesId: null,
        installment: null,
        notes: null,
      },
      recurring && !isContribution
        ? { kind: seriesKind, frequency, occurrences: Number.parseInt(occurrences, 10) }
        : null,
    )

    if (!isEditing) {
      setDescription('')
      setAmount('')
      setRecurring(false)
      setErrors({})
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Segmented
        label="Tipo de lançamento"
        options={KIND_OPTIONS}
        value={kind}
        onChange={setKind}
      />

      {noGoals ? (
        <p className="rounded-xl bg-sunken px-3 py-2.5 text-xs text-muted">
          Você ainda não tem metas. Crie uma em <strong className="text-ink">Metas</strong> para
          poder destinar dinheiro a ela.
        </p>
      ) : null}

      {isContribution ? (
        <Field label="Meta de destino" error={errors.goal}>
          {({ id, describedBy, invalid }) => (
            <SelectInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={goalId}
              disabled={noGoals}
              onChange={(event) => setGoalId(event.target.value)}
            >
              {activeGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
      ) : (
        <Field label="Descrição" error={errors.description}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={description}
              placeholder="Mercado, aluguel, salário…"
              onChange={(event) => setDescription(event.target.value)}
            />
          )}
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor" error={errors.amount}>
          {({ id, describedBy, invalid }) => (
            <MoneyInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          )}
        </Field>

        <Field label="Data" error={errors.date}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="date"
              required
              aria-describedby={describedBy}
              invalid={invalid}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          )}
        </Field>
      </div>

      {!isContribution ? (
        <Field label="Categoria">
          {({ id }) => (
            <SelectInput
              id={id}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
      ) : null}

      {accounts.length > 0 ? (
        <Field label="Conta ou cartão" hint="Opcional. Ajuda a separar o que saiu de onde.">
          {({ id, describedBy }) => (
            <SelectInput
              id={id}
              aria-describedby={describedBy}
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">Não informar</option>
              {accounts
                .filter((account) => !account.archived)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </SelectInput>
          )}
        </Field>
      ) : null}

      {/*
        Recorrência só na criação: editar uma parcela isolada é o caso normal
        (a conta de luz muda de valor), então transformar uma edição em nova
        série apagaria as outras parcelas sem o usuário pedir.
      */}
      {!isContribution && !isEditing ? (
        <div className="rounded-xl bg-sunken p-3">
          <Toggle
            checked={recurring}
            onChange={setRecurring}
            label="Repetir lançamento"
            description="Cria todas as cobranças de uma vez, cada uma editável."
            icon="repeat"
          />

          {recurring ? (
            <div className="mt-3 space-y-3 border-t border-hairline pt-3">
              {/*
                A escolha vem antes das outras duas de propósito: ela muda o
                que as próximas significam. Em parcelamento, "repetições" é o
                número de vezes que a compra foi fatiada e o total já está
                decidido; em assinatura, é só até onde as cobranças foram
                lançadas, e nada impede lançar mais depois.

                Sem esta pergunta as duas ficam idênticas no histórico, e as
                páginas de Parcelamentos e Assinaturas teriam que adivinhar
                pela categoria ou pelo nome — o que erraria calado.
              */}
              <fieldset>
                <legend className="mb-1.5 text-xs font-medium text-muted">Tipo</legend>
                <div className="grid grid-cols-2 gap-2">
                  {SERIES_KIND_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[0.8125rem] font-medium transition-colors duration-150',
                        seriesKind === option.value
                          ? 'border-transparent bg-block text-block-ink'
                          : 'border-hairline bg-sheet text-ink-secondary hover:text-ink',
                      )}
                    >
                      <input
                        type="radio"
                        name="series-kind"
                        value={option.value}
                        checked={seriesKind === option.value}
                        onChange={() => setSeriesKind(option.value)}
                        className="sr-only"
                      />
                      <Icon name={option.icon} size={14} />
                      {option.label}
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {SERIES_KIND_OPTIONS.find((option) => option.value === seriesKind)?.hint}
                </p>
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
              <Field label={seriesKind === 'installment' ? 'Parcelas' : 'Cobranças'} error={errors.occurrences}>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    type="number"
                    min={2}
                    max={120}
                    value={occurrences}
                    onChange={(event) => setOccurrences(event.target.value)}
                    className="bg-sheet"
                  />
                )}
              </Field>
              <Field label="Frequência">
                {({ id }) => (
                  <SelectInput
                    id={id}
                    value={frequency}
                    onChange={(event) => setFrequency(event.target.value as RecurrenceFrequency)}
                    className="bg-sheet"
                  >
                    {Object.entries(FREQUENCY_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} block>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={noGoals} block icon={isEditing ? 'check' : 'plus'}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
