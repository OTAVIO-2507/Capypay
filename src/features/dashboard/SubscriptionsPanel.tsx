import { Icon } from '@/components/Icon'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Figure, Money } from '@/components/ui/Money'
import { QuietLink } from '@/components/ui/QuietLink'
import { monthlySubscriptionCost, type Subscription } from '@/domain/subscriptions'
import { formatDayMonth } from '@/lib/date'

interface SubscriptionsPanelProps {
  subscriptions: readonly Subscription[]
}

/** Quantas cabem antes de a lista virar rolagem dentro de um painel de resumo. */
const VISIVEIS = 3

/**
 * O que se repete todo mês, e quanto isso já custa antes de o mês começar.
 *
 * Ocupa o lugar de "Ainda vence este mês", que respondia uma pergunta menor:
 * aquele painel só enxergava a virada do mês corrente e zerava ao consultar um
 * mês passado. Assinatura não é evento do mês, é compromisso permanente — a
 * pergunta útil não é "o que falta pagar em agosto" mas "quanto do meu mês já
 * está vendido antes de eu gastar qualquer coisa".
 *
 * Por isso o painel não recebe `month`: ele fala do presente para a frente,
 * independente do mês que a página está mostrando. É o único painel do painel
 * principal que se comporta assim, e é de propósito.
 *
 * A figura é a soma **mensal**, com semanal e anual já convertidos — sem isso
 * um seguro anual de R$ 300 pesaria seis vezes mais que um streaming de R$ 50
 * num total que se chama "por mês".
 *
 * Sem logotipo de marca nas linhas: o ícone é o da categoria, na mesma pastilha
 * que o resto do produto usa. Carregar a arte de cada serviço traria uma cor
 * por linha e abriria uma quarta exceção de cor para decoração — e a lista já
 * se lê pelo nome, que é o que a pessoa procura.
 */
export function SubscriptionsPanel({ subscriptions }: SubscriptionsPanelProps) {
  const total = monthlySubscriptionCost(subscriptions)
  const restantes = subscriptions.length - VISIVEIS

  return (
    <Card className="flex w-full flex-col">
      <CardHeader
        title="Assinaturas"
        action={
          subscriptions.length > 0 ? <QuietLink to="/assinaturas">Ver todas</QuietLink> : undefined
        }
      />

      {subscriptions.length === 0 ? (
        <EmptyState
          icon="repeat"
          size="sm"
          title="Nenhuma assinatura ativa"
          description="Ao lançar uma despesa, marque “Repetir lançamento” para ela entrar aqui com a data da próxima cobrança."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <Figure cents={total} size="sm" />
            <span className="text-xs text-muted">
              por mês · {subscriptions.length}{' '}
              {subscriptions.length === 1 ? 'ativa' : 'ativas'}
            </span>
          </div>

          <ul className="mt-5 flex flex-1 flex-col divide-y divide-hairline">
            {subscriptions.slice(0, VISIVEIS).map((item) => (
              <li
                key={item.seriesId}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm bg-sunken text-faint">
                    <Icon name={item.icon} size={14} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.8125rem] font-medium text-ink">
                      {item.label}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <Icon name="calendar" size={11} className="shrink-0" />
                      <span className="truncate">Próxima: {formatDayMonth(item.next)}</span>
                    </span>
                  </span>
                </span>
                <Money cents={item.amountCents} className="shrink-0 text-[0.8125rem]" />
              </li>
            ))}
          </ul>

          {restantes > 0 ? (
            <div className="mt-3.5 border-t border-hairline pt-3 text-xs text-muted">
              +{restantes} {restantes === 1 ? 'assinatura' : 'assinaturas'}
            </div>
          ) : null}
        </>
      )}
    </Card>
  )
}
