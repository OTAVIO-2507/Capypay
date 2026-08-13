import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import type { Account } from '@/domain/types'
import { usePrivacy } from '@/store/hooks'

interface PaymentCardProps {
  account: Account | undefined
  holder: string
}

/**
 * O cartão cadastrado, desenhado em proporção real (1,586:1).
 *
 * Não é ornamento: os dados vêm da conta que o usuário cadastrou. Sem conta,
 * o espaço mostra um convite a cadastrar em vez de um cartão fictício — um
 * painel financeiro que exibe um cartão inventado ensina o usuário a
 * desconfiar de tudo que ele mostra.
 */
export function PaymentCard({ account, holder }: PaymentCardProps) {
  const masked = usePrivacy()

  if (!account) {
    return (
      <Link
        to="/contas"
        className="flex aspect-[1.586] w-full flex-col items-center justify-center gap-2.5 rounded-md border border-dashed border-hairline-strong p-6 text-center transition-colors duration-150 hover:bg-sunken"
      >
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-sunken text-faint">
          <Icon name="credit-card" size={20} />
        </span>
        <span className="text-[0.8125rem] font-semibold text-ink">Cadastrar um cartão</span>
        <span className="max-w-[32ch] text-xs leading-relaxed text-muted">
          Para separar de onde cada gasto saiu e acompanhar o ciclo da fatura.
        </span>
      </Link>
    )
  }

  // Agrupamento de quatro em quatro, como no cartão físico. Só os últimos
  // quatro dígitos são reais; o resto nunca foi guardado.
  const digits = account.last4 ? `•••• •••• •••• ${account.last4}` : '•••• •••• •••• ••••'

  return (
    <div className="relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-md bg-block p-6 text-block-ink shadow-[var(--shadow-block)]">
      {/*
        Brilho diagonal levíssimo: é o reflexo do plástico, e a única textura
        do sistema. Feito com opacidade sobre a própria tinta, nunca com matiz.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0)_38%,rgba(255,255,255,0)_62%,rgba(255,255,255,0.06)_100%)] dark:bg-[linear-gradient(120deg,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0)_38%,rgba(0,0,0,0)_62%,rgba(0,0,0,0.04)_100%)]"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <ChipGlyph />
          <span className="min-w-0">
            <span className="block truncate text-[0.8125rem] font-semibold">{account.name}</span>
            {account.institution ? (
              <span className="block truncate text-xs text-block-muted">{account.institution}</span>
            ) : null}
          </span>
        </div>
        <Icon name="wifi" size={18} className="shrink-0 rotate-90 opacity-70" />
      </div>

      <div className="relative">
        <p className="tnum font-mono text-base tracking-[0.14em] sm:text-lg">
          {masked ? '•••• •••• •••• ••••' : digits}
        </p>

        <div className="mt-5 flex items-end justify-between gap-4">
          {/*
            O par "Titular" só aparece quando existe um nome no perfil. Sem
            ele, repetir aqui o nome da conta — que já está no topo do cartão —
            enche a linha sem informar nada.
          */}
          {holder ? (
            <div className="min-w-0">
              <p className="text-[0.625rem] tracking-[0.08em] text-block-muted uppercase">
                Titular
              </p>
              <p className="mt-1 truncate text-[0.8125rem] font-medium">{holder}</p>
            </div>
          ) : (
            <span />
          )}
          <div className="shrink-0 text-right">
            <p className="text-[0.625rem] tracking-[0.08em] text-block-muted uppercase">
              {account.creditCard ? 'Fecha' : 'Tipo'}
            </p>
            <p className="tnum mt-1 font-mono text-[0.8125rem] font-medium">
              {account.creditCard ? `dia ${account.creditCard.closingDay}` : 'Conta'}
            </p>
          </div>
        </div>
      </div>

      <p className="sr-only">
        {account.name}
        {account.institution ? `, ${account.institution}` : ''}
        {account.last4 ? `, final ${account.last4}` : ''}
      </p>
    </div>
  )
}

/** O chip. Desenhado à mão para não depender de imagem nem de fonte de ícone. */
function ChipGlyph() {
  return (
    <svg
      width="34"
      height="26"
      viewBox="0 0 34 26"
      fill="none"
      aria-hidden="true"
      className="opacity-90"
    >
      <rect x="0.6" y="0.6" width="32.8" height="24.8" rx="4.4" stroke="currentColor" strokeWidth="1.2" opacity="0.65" />
      <path d="M0 8.5h9M0 17.5h9M25 8.5h9M25 17.5h9M9 0.5v25M25 0.5v25" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
      <rect x="9" y="8.5" width="16" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.2" opacity="0.65" />
    </svg>
  )
}
