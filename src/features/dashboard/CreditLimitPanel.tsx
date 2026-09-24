import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ItemRow, MetaDot } from '@/components/ui/ItemRow'
import { Figure, Money } from '@/components/ui/Money'
import type { CardSummary } from '@/domain/invoices'
import { BankBadge, cardName } from '@/features/accounts/CardTile'
import type { BankBrand } from '@/features/dashboard/bankBrand'
import { findBankBrand } from '@/features/dashboard/bankBrand'
import { cn } from '@/lib/cn'
import { fromIsoDate } from '@/lib/date'

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "10 set", o vencimento curto da referência. */
function diaEMes(iso: string): string {
  const data = fromIsoDate(iso)
  return data ? `${data.getDate()} ${MES[data.getMonth()]}` : '—'
}

/** O disponível de um cartão: limite menos o tomado, nunca negativo. */
function disponivelDe(resumo: CardSummary): number | null {
  if (resumo.limitCents == null || resumo.usedCents == null) return null
  return Math.max(resumo.limitCents - resumo.usedCents, 0)
}

/**
 * "Limite total disponível" — quanto ainda cabe nos cartões.
 *
 * Como na referência: o disponível somado em destaque, o limite total em uma
 * linha abaixo, e cada cartão com o disponível dele. O número principal é o
 * disponível porque é a pergunta que alguém faz antes de uma compra grande:
 * "ainda cabe?".
 *
 * Usa o mesmo resumo de cartão da tela de Contas, e por isso as duas telas
 * dizem o mesmo número. O disponível vem do banco quando ele informa; sem
 * isso, é estimado pela fatura aberta mais as parcelas já lançadas, e a
 * legenda diz "estimado" — mostrar travessão aqui enquanto Contas mostra um
 * valor deixava as duas telas discordando sobre o mesmo cartão.
 */
export function CreditLimitPanel({
  resumos,
  fallbackBank,
  className,
}: {
  resumos: readonly CardSummary[]
  /** O banco reconhecido em outra conta da mesma conexão. Ver `CardTile`. */
  fallbackBank: BankBrand | null
  className?: string
}) {
  const comLimite = resumos.filter((resumo) => resumo.limitCents != null)

  if (resumos.length === 0) {
    return (
      <Card className={cn('flex flex-col', className)}>
        <CardHeader title="Limite total disponível" />
        <EmptyState
          icon="credit-card"
          size="sm"
          title="Nenhum cartão ainda"
          description="Conecte o banco, ou cadastre um cartão com o limite em Contas, e o disponível aparece aqui."
        />
      </Card>
    )
  }

  const limiteTotal = comLimite.reduce((soma, resumo) => soma + (resumo.limitCents ?? 0), 0)
  const disponiveis = comLimite.map(disponivelDe).filter((valor): valor is number => valor !== null)
  const disponivelTotal = disponiveis.length === 0 ? null : disponiveis.reduce((soma, valor) => soma + valor, 0)
  const algumEstimado = comLimite.some((resumo) => !resumo.usedFromBank)

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title="Limite total disponível" />

      {disponivelTotal === null ? (
        <Figure value="—" />
      ) : (
        <Figure cents={disponivelTotal} />
      )}
      <p className="mt-2 text-[0.9375rem] text-muted">
        {comLimite.length === 0 ? (
          'Nenhum cartão com limite informado'
        ) : (
          <>
            de <Money cents={limiteTotal} className="text-[0.9375rem] text-muted" /> de limite total
            {algumEstimado ? ' · estimado' : ''}
          </>
        )}
      </p>

      <ul className="mt-5 flex flex-1 flex-col">
        {resumos.map((resumo) => {
          const banco = findBankBrand(resumo.account.name, resumo.account.institution) ?? fallbackBank
          const nome = cardName(resumo.account, banco)
          const disponivel = disponivelDe(resumo)

          return (
            <li key={resumo.account.id}>
              <ItemRow
                media={<BankBadge banco={banco} nome={nome} size={48} />}
                title={<span className="text-[0.9375rem]">{nome}</span>}
                meta={
                  <span className="flex items-center gap-2 text-[0.8125rem]">
                    {resumo.account.last4 ? (
                      <span className="tnum">
                        <span aria-hidden>•••• </span>
                        <span className="sr-only">final </span>
                        {resumo.account.last4}
                      </span>
                    ) : null}
                    {resumo.account.last4 && resumo.window.due ? <MetaDot /> : null}
                    {resumo.window.due ? <span>Vence {diaEMes(resumo.window.due)}</span> : null}
                  </span>
                }
                value={
                  disponivel === null ? (
                    <span className="text-[0.9375rem] text-muted">—</span>
                  ) : (
                    <Money cents={disponivel} className="text-[0.9375rem] font-semibold" />
                  )
                }
                caption={
                  resumo.limitCents == null
                    ? 'sem limite'
                    : resumo.usedFromBank
                      ? 'disponível'
                      : 'disponível (estimado)'
                }
              />
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
