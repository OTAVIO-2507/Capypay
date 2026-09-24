import { useMemo, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import { Dialog } from '@/components/ui/Dialog'
import { Money } from '@/components/ui/Money'
import { categoryColor } from '@/domain/categories'
import type { Subscription, SubscriptionCadence } from '@/domain/subscriptions'
import type { Account, Category, Goal, Transaction } from '@/domain/types'
import { BankTag } from '@/features/dashboard/BankTag'
import { BrandMark, findBrand } from '@/features/series/BrandMark'
import { CategoryPill, CategoryTile } from '@/features/transactions/CategoryMarks'
import { SignedAmount } from '@/features/transactions/TransactionMiniRow'
import { presentTransaction } from '@/features/transactions/presentation'
import { formatDayMonthYear, todayIso } from '@/lib/date'

/** Quantas cobranças passadas o detalhe mostra antes de virar rolagem longa. */
const COBRANCAS_VISIVEIS = 6

/** O nome da cadência por extenso, para a linha de "Cobrança". */
const CADENCIA: Record<SubscriptionCadence, string> = {
  weekly: 'Toda semana',
  monthly: 'Todo mês',
  yearly: 'Todo ano',
}

/** O sufixo do valor, que é a unidade dele. */
const POR_CADENCIA: Record<SubscriptionCadence, string> = {
  weekly: '/semana',
  monthly: '/mês',
  yearly: '/ano',
}

interface SubscriptionDetailsProps {
  /** A assinatura aberta. Nula fecha o detalhe. */
  subscription: Subscription | null
  /** O histórico inteiro, de onde saem as cobranças da série. */
  transactions: readonly Transaction[]
  categories: readonly Category[]
  goals: readonly Goal[]
  accounts: readonly Account[]
  onClose: () => void
  /**
   * Abre o lançamento de uma cobrança. Sem ele as cobranças ficam como lista
   * de leitura — que é o certo onde não há tela de detalhe de lançamento para
   * onde ir.
   */
  onOpenTransaction?: (transaction: Transaction) => void
}

/**
 * O detalhe de uma assinatura: quanto ela custa, quando cobra de novo, de onde
 * sai, e há quanto tempo isso acontece.
 *
 * Segue a forma do detalhe de lançamento, e não uma própria: marca, nome e
 * valor no alto; os campos em linhas de rótulo e valor; e uma seção no pé com
 * a lista que responde a pergunta que os campos não respondem. Lá são as
 * transações semelhantes; aqui é o histórico de cobranças, que é o que mostra
 * se o valor subiu e desde quando o serviço está sendo pago.
 *
 * A assinatura não é uma entidade gravada — ela é derivada da série de
 * lançamentos (ver `domain/subscriptions.ts`). Por isso todo campo aqui sai ou
 * da série ou da cobrança mais recente dela, e não de um cadastro.
 */
export function SubscriptionDetails({
  subscription,
  transactions,
  categories,
  goals,
  accounts,
  onClose,
  onOpenTransaction,
}: SubscriptionDetailsProps) {
  /** A série inteira, da cobrança mais recente para a mais antiga. */
  const serie = useMemo(() => {
    if (!subscription) return []
    return transactions
      .filter((item) => item.seriesId === subscription.seriesId)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [subscription, transactions])

  /*
   * A lista mostra só as cobranças que **já aconteceram**.
   *
   * Uma assinatura cadastrada pela tela nasce com as próximas doze cobranças
   * materializadas, então a série tem futuro dentro dela. Listar esse futuro
   * debaixo de "cobranças anteriores" seria a tela dizendo que março do ano que
   * vem já foi pago. A próxima cobrança tem linha própria lá em cima, que é
   * onde o futuro desta série cabe.
   */
  const cobrancas = useMemo(() => {
    const hoje = todayIso()
    return serie.filter((item) => item.date <= hoje)
  }, [serie])

  const marca = subscription ? findBrand(subscription.label) : null
  const nome = marca?.nome ?? subscription?.label ?? ''
  const conta = subscription?.accountId
    ? accounts.find((item) => item.id === subscription.accountId)
    : undefined

  /*
   * A cobrança que representa a série nos campos que pertencem ao lançamento
   * e não à assinatura — a categoria, hoje.
   *
   * A mais recente **já lançada**, porque é a que tem a classificação mais
   * atual: recategorizar uma série mexe nas cobranças. Sem nenhuma lançada,
   * cai na série inteira — uma assinatura cadastrada hoje só tem futuro, e sem
   * esta segunda tentativa a linha "Categoria" simplesmente sumia do detalhe
   * dela, apagando um dado que o produto conhece.
   */
  const representante = cobrancas[0] ?? serie[0]

  return (
    <Dialog
      open={subscription !== null}
      onClose={onClose}
      /* A mesma largura do detalhe de lançamento: são o mesmo padrão, e dois
         tamanhos fariam a janela mudar de forma conforme o que se abriu. */
      size="lg"
      title="Detalhes da assinatura"
      initialFocus="dialog"
    >
      {subscription ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <BrandMark
              label={subscription.label}
              fallbackIcon={subscription.icon}
              fallbackColor={categoryColor(subscription.categoryId)}
              size={56}
              className="rounded-lg"
            />
            <div className="min-w-0">
              <p className="text-lg leading-snug font-semibold break-words text-ink">{nome}</p>
              {/* O texto cru do banco, só quando o título virou marca: é por
                  ele que a pessoa confere a cobrança na fatura. */}
              {marca ? (
                <p className="mt-0.5 text-[0.8125rem] break-words text-muted">
                  {subscription.label}
                </p>
              ) : null}
              <p className="mt-1.5 text-2xl leading-tight font-bold text-ink">
                <Money cents={subscription.amountCents} />
                <span className="ml-1.5 text-sm font-medium text-muted">
                  {POR_CADENCIA[subscription.cadence]}
                </span>
              </p>
            </div>
          </div>

          <dl className="flex flex-col gap-3.5 text-[0.8125rem]">
            <Linha icone="calendar" rotulo="Próxima cobrança">
              <time dateTime={subscription.next}>{formatDayMonthYear(subscription.next)}</time>
            </Linha>
            <Linha icone="repeat" rotulo="Cobrança">
              {CADENCIA[subscription.cadence]}
            </Linha>
            {conta ? (
              <Linha icone="credit-card" rotulo="Conta">
                <BankTag account={conta} className="justify-end" />
              </Linha>
            ) : null}
            {representante ? (
              <Linha icone="tags" rotulo="Categoria">
                <CategoryPill
                  transaction={representante}
                  view={presentTransaction(representante, categories, goals)}
                />
              </Linha>
            ) : null}
            {/*
              A projeção anual é o número que muda decisão. Quarenta reais por
              mês é fácil de aceitar; é sobre doze meses que a conta assusta, e
              ela some se a pessoa tiver que fazê-la de cabeça.
            */}
            <Linha icone="coins" rotulo="No ano">
              <Money cents={subscription.monthlyCents * 12} />
            </Linha>
          </dl>

          <section aria-labelledby={`cobrancas-${subscription.seriesId}`}>
            <h3
              id={`cobrancas-${subscription.seriesId}`}
              className="flex items-center gap-2 text-sm font-semibold text-ink"
            >
              <Icon name="clock" size={15} className="text-muted" />
              Cobranças anteriores
            </h3>

            {cobrancas.length === 0 ? (
              <p className="mt-3 py-4 text-center text-[0.8125rem] text-muted">
                Nenhuma cobrança lançada ainda
              </p>
            ) : (
              <>
                <ul className="mt-3 flex flex-col gap-2">
                  {cobrancas.slice(0, COBRANCAS_VISIVEIS).map((cobranca) => {
                    const visao = presentTransaction(cobranca, categories, goals)
                    const conteudo = (
                      <>
                        <CategoryTile transaction={cobranca} view={visao} size={36} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.8125rem] font-medium text-ink">
                            {formatDayMonthYear(cobranca.date)}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {cobranca.description}
                          </span>
                        </span>
                        <SignedAmount
                          view={visao}
                          className="shrink-0 text-[0.8125rem] font-semibold"
                        />
                      </>
                    )

                    return (
                      <li key={cobranca.id}>
                        {onOpenTransaction ? (
                          <button
                            type="button"
                            onClick={() => onOpenTransaction(cobranca)}
                            className="flex w-full items-center gap-3 rounded-md bg-sunken px-4 py-3 text-left transition-colors duration-150 hover:bg-hairline"
                          >
                            {conteudo}
                          </button>
                        ) : (
                          <div className="flex w-full items-center gap-3 rounded-md bg-sunken px-4 py-3 text-left">
                            {conteudo}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>

                {cobrancas.length > COBRANCAS_VISIVEIS ? (
                  <p className="mt-3 text-xs text-muted">
                    +{cobrancas.length - COBRANCAS_VISIVEIS} cobranças no histórico
                  </p>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : null}
    </Dialog>
  )
}

function Linha({ icone, rotulo, children }: { icone: IconName; rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex shrink-0 items-center gap-2.5 text-muted">
        <Icon name={icone} size={16} className="shrink-0" />
        {rotulo}:
      </dt>
      <dd className="flex min-w-0 justify-end text-ink">{children}</dd>
    </div>
  )
}
