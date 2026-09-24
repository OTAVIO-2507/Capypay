import type { ReactNode } from 'react'
import { Icon } from '@/components/Icon'
import { Money } from '@/components/ui/Money'
import { Popover } from '@/components/ui/Popover'
import type { CardSummary } from '@/domain/invoices'
import type { Account } from '@/domain/types'
import type { BankBrand } from '@/features/dashboard/bankBrand'
import { findBankBrand } from '@/features/dashboard/bankBrand'
import { cn } from '@/lib/cn'
import { formatDayMonth, fromIsoDate } from '@/lib/date'
import { formatCurrencyCompact } from '@/lib/format'
import { usePrivacy } from '@/store/hooks'

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "13/set/2026", a forma curta da referência para a data dos dados. */
function dataCurta(data: Date): string {
  return `${String(data.getDate()).padStart(2, '0')}/${MES[data.getMonth()]}/${data.getFullYear()}`
}

/**
 * O nome do cartão como a pessoa o reconhece: "Inter Gold", e não "GOLD".
 *
 * O cartão importado chega com o nome comercial em caixa alta e sem o banco,
 * que vem noutro campo. Juntar os dois, em caixa de título, é o nome que está
 * impresso no plástico.
 */
export function cardName(account: Account, banco: BankBrand | null): string {
  const cru = account.name.trim()
  const nome = cru === cru.toUpperCase()
    ? cru.toLowerCase().replace(/(^|\s)\p{L}/gu, (letra) => letra.toUpperCase())
    : cru
  if (!banco) return nome
  const semAcento = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return semAcento(nome).includes(semAcento(banco.nome)) ? nome : `${banco.nome} ${nome}`
}

/**
 * Um cartão de crédito: a fatura aberta, quando vence e quanto do limite está
 * tomado — as três perguntas de quem abre esta tela.
 *
 * A fatura é **estimada** e diz isso no rótulo, com a data até onde os dados
 * chegam logo abaixo: é a soma das compras que o produto recebeu, e o banco
 * pode ter compras que ainda não repassou.
 */
export function CardTile({
  summary,
  fallbackBank,
  onRemove,
  onOpenDetails,
}: {
  summary: CardSummary
  /**
   * O banco reconhecido em outra conta da mesma conexão. O cartão importado
   * chega com a instituição "MeuPluggy" — o proxy da conexão, não o banco —,
   * e é da conta corrente que sai o nome.
   */
  fallbackBank: BankBrand | null
  onRemove: () => void
  onOpenDetails: () => void
}) {
  const masked = usePrivacy()
  const { account, window, invoiceCents, lastTransactionDate, limitCents, usedCents } = summary
  const banco = findBankBrand(account.name, account.institution) ?? fallbackBank
  const nome = cardName(account, banco)

  const ultimaCompra = lastTransactionDate ? fromIsoDate(lastTransactionDate) : null
  const sincronizado = account.sync?.lastSyncedAt ? new Date(account.sync.lastSyncedAt) : null

  const usadoPct =
    limitCents && usedCents != null ? Math.min(Math.max(usedCents / limitCents, 0), 1) * 100 : 0
  const disponivel = limitCents != null && usedCents != null ? Math.max(limitCents - usedCents, 0) : null

  return (
    <article className="group relative overflow-hidden rounded-lg border border-hairline bg-sheet p-6 transition-colors duration-150 hover:border-hairline-strong">
      {/* O círculo do canto é só textura, como na referência. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-14 -right-14 size-52 rounded-full bg-sunken/70"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BankBadge banco={banco} nome={nome} size={56} />
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-ink">{nome}</h3>
            {account.last4 ? (
              <p className="tnum text-sm text-muted">
                <span aria-hidden>•••• </span>
                <span className="sr-only">final </span>
                {account.last4}
              </p>
            ) : null}
          </div>
        </div>

        <Popover
          label={`Ações de ${nome}`}
          width={200}
          trigger={({ open, toggle, controls }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls={controls}
              aria-label={`Ações de ${nome}`}
              className={cn(
                'inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150',
                open ? 'bg-sunken text-ink' : 'text-muted hover:bg-sunken hover:text-ink',
              )}
            >
              <Icon name="ellipsis-vertical" size={16} />
            </button>
          )}
        >
          {({ close }) => (
            <div className="p-1.5">
              <button
                type="button"
                onClick={() => {
                  close()
                  onRemove()
                }}
                className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-[0.8125rem] font-medium text-expense transition-colors duration-150 hover:bg-sunken"
              >
                <Icon name="trash-2" size={15} />
                Remover cartão
              </button>
            </div>
          )}
        </Popover>
      </div>

      <div className="relative mt-5">
        <p className="flex items-center gap-1.5 text-sm text-muted">
          Fatura estimada
          <span
            title="Soma das compras deste cartão entre o fechamento anterior e o próximo."
            className="inline-flex text-attention"
          >
            <Icon name="info" size={15} aria-hidden />
            <span className="sr-only">
              Soma das compras deste cartão entre o fechamento anterior e o próximo.
            </span>
          </span>
        </p>
        <Money cents={invoiceCents} className="mt-1 block text-4xl leading-tight font-bold tracking-tight" />
        {ultimaCompra || sincronizado ? (
          <p className="mt-1.5 text-sm text-muted">
            {ultimaCompra ? `Transações até ${dataCurta(ultimaCompra)}` : null}
            {ultimaCompra && sincronizado ? ' · ' : null}
            {sincronizado
              ? `sync ${dataCurta(sincronizado)} ${String(sincronizado.getHours()).padStart(2, '0')}:${String(sincronizado.getMinutes()).padStart(2, '0')}`
              : null}
          </p>
        ) : null}
        <div className="mt-3 flex min-h-8 items-center justify-between gap-3">
          {window.due ? (
            <p className="text-sm text-muted">
              Vence <strong className="font-semibold text-ink">{formatDayMonth(window.due)}</strong>
            </p>
          ) : (
            <span />
          )}
          {/*
            Aparece ao passar o mouse, como na referência — mas só onde existe
            mouse. Em tela de toque não há "passar por cima", e um botão que só
            existe no hover simplesmente não existiria ali. O foco pelo teclado
            também o revela, senão ele seria alcançável e invisível.
          */}
          <button
            type="button"
            onClick={onOpenDetails}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-ink transition-opacity duration-150 hover:underline [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
          >
            Ver detalhes
            <Icon name="arrow-up-right" size={14} />
          </button>
        </div>
      </div>

      <div className="relative mt-4 border-t border-hairline pt-4">
        {limitCents == null ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Icon name="credit-card" size={15} className="shrink-0" />
            Limite não informado
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-muted">
                <Icon name="credit-card" size={15} className="shrink-0" />
                Limite total
              </span>
              <span className="tnum font-semibold text-ink">
                {formatCurrencyCompact(limitCents, { masked })}
              </span>
            </div>

            {/*
              Duas cores na mesma barra, como na referência: o tomado e o que
              sobra. A legenda embaixo diz os dois em número, e a barra é só a
              proporção deles — não é a única leitura de nada.
            */}
            <div
              role="img"
              aria-label={
                usedCents == null
                  ? 'Uso do limite desconhecido'
                  : `${Math.round(usadoPct)}% do limite usado`
              }
              className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-sunken"
            >
              {usedCents != null ? (
                <>
                  <span style={{ width: `${usadoPct}%`, backgroundColor: 'var(--limit-used)' }} />
                  <span className="bg-accent" style={{ width: `${100 - usadoPct}%` }} />
                </>
              ) : null}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
              <Legenda cor="var(--limit-used)" rotulo={summary.usedFromBank ? 'Usado' : 'Usado (estimado)'}>
                {usedCents == null ? '—' : formatCurrencyCompact(usedCents, { masked })}
              </Legenda>
              <Legenda cor="var(--accent)" rotulo="Disponível" destaque>
                {disponivel == null ? '—' : formatCurrencyCompact(disponivel, { masked })}
              </Legenda>
            </div>
          </>
        )}
      </div>
    </article>
  )
}

function Legenda({
  cor,
  rotulo,
  destaque = false,
  children,
}: {
  cor: string
  rotulo: string
  destaque?: boolean
  children: ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: cor }} />
      <span className="text-muted">{rotulo}</span>
      <span className={cn('tnum font-semibold', destaque ? 'text-accent' : 'text-ink')}>{children}</span>
    </span>
  )
}

/** A pastilha do banco do cartão: a cor da instituição e as iniciais. */
export function BankBadge({ banco, nome, size = 44 }: { banco: BankBrand | null; nome: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        ...(banco ? { backgroundColor: banco.cor, color: banco.tinta } : {}),
      }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md text-sm font-bold',
        !banco && 'bg-sunken text-muted',
      )}
    >
      {(banco?.nome ?? nome).slice(0, 2).toUpperCase()}
    </span>
  )
}
