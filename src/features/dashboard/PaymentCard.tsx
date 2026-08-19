import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import type { Account } from '@/domain/types'
import { usePrivacy } from '@/store/hooks'
import { findBankBrand, type BankBrand } from './bankBrand'

interface PaymentCardProps {
  account: Account | undefined
  holder: string
  /**
   * Banco reconhecido em outra conta da mesma conexão.
   *
   * Um cartão chega chamado de "GOLD", e pelo Meu Pluggy a instituição vem como
   * "MeuPluggy" — o proxy, não o banco. Quem costuma carregar o nome é a conta
   * corrente, e como as contas de uma conexão são todas do mesmo banco, o que
   * uma sabe vale para as outras.
   */
  fallbackBank?: BankBrand | null
}

/**
 * O cartão da conta, desenhado em proporção real (1,586:1).
 *
 * Sem conta cadastrada, o espaço mostra o mesmo desenho preenchido com dados
 * de exemplo, e **dito** como exemplo: a etiqueta no canto e o convite embaixo
 * existem para que ninguém confunda o desenho com um cartão de verdade. Um
 * painel financeiro que exibe número inventado sem avisar ensina a desconfiar
 * de tudo que ele mostra, e é essa a linha que a etiqueta não deixa cruzar.
 */
export function PaymentCard({ account, holder, fallbackBank }: PaymentCardProps) {
  const masked = usePrivacy()

  if (!account) {
    return <ExampleCard />
  }

  // Agrupamento de quatro em quatro, como no cartão físico. Só os últimos
  // quatro dígitos são reais; o resto nunca foi guardado.
  const digits = account.last4 ? `•••• •••• •••• ${account.last4}` : '•••• •••• •••• ••••'

  /*
   * O banco reconhecido serve para **nomear**, não para colorir.
   *
   * O cartão continua em bloco de tinta, como todo o resto do sistema: vesti-lo
   * com a cor da instituição foi tentado e desfeito a pedido, e a Regra da
   * Tinta Escassa volta a valer aqui. O que o reconhecimento ainda entrega é o
   * nome certo — pelo Meu Pluggy a instituição chega como "MeuPluggy", que é o
   * proxy da conexão e não diz de que banco a conta é.
   */
  const banco = findBankBrand(account.name, account.institution) ?? fallbackBank ?? null

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
            <span className="block truncate text-[0.8125rem] font-semibold">
              {banco?.nome ?? account.name}
            </span>
            {banco ? (
              <span className="block truncate text-xs text-block-muted">{account.name}</span>
            ) : account.institution ? (
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
          {/*
            A bandeira toma o lugar do rótulo quando a instituição informa qual
            é. É o canto que o cartão físico reserva para ela, e reconhecê-la
            ali é imediato; "Tipo: Conta" no mesmo espaço não diz nada que o
            resto do cartão já não tenha dito.
          */}
          {account.brand ? (
            <BrandFlag brand={account.brand} />
          ) : (
            <div className="shrink-0 text-right">
              <p className="text-[0.625rem] tracking-[0.08em] text-block-muted uppercase">
                {account.creditCard ? 'Fecha' : 'Tipo'}
              </p>
              <p className="tnum mt-1 font-mono text-[0.8125rem] font-medium">
                {account.creditCard ? `dia ${account.creditCard.closingDay}` : 'Conta'}
              </p>
            </div>
          )}
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

/**
 * O cartão de exemplo, para o painel não abrir com um buraco.
 *
 * Repete o desenho do cartão real de propósito: quem chega sem conta vê o que
 * vai ganhar ao conectar o banco, em vez de um retângulo tracejado descrevendo
 * a mesma coisa em palavras. O que separa os dois é a etiqueta "Exemplo" e o
 * número visivelmente fictício, porque a semelhança só é honesta enquanto a
 * diferença estiver dita.
 */
function ExampleCard() {
  return (
    <Link
      to="/importar"
      className="group relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-md border border-dashed border-hairline-strong p-6 text-muted transition-colors duration-150 hover:border-hairline-strong hover:bg-sunken"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5 opacity-45">
          <ChipGlyph />
          <span className="text-[0.8125rem] font-semibold text-ink">Seu banco aqui</span>
        </div>
        <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-faint">
          Exemplo
        </span>
      </div>

      <div>
        <p className="tnum font-mono text-base tracking-[0.14em] opacity-40 sm:text-lg">
          •••• •••• •••• 0000
        </p>
        <p className="mt-5 max-w-[34ch] text-xs leading-relaxed">
          Conecte o banco ou importe um extrato para o seu cartão aparecer aqui, com o saldo real.
        </p>
      </div>
    </Link>
  )
}

/**
 * A bandeira do cartão, desenhada e não baixada.
 *
 * Mesma escolha da marca das assinaturas: buscar a imagem de fora entregaria a
 * um terceiro a informação de que esta pessoa tem este cartão. As duas formas
 * que valem a pena desenhar são as que se reconhecem por geometria pura, e a
 * Mastercard é o caso perfeito — dois círculos que se cruzam, legíveis a
 * qualquer tamanho. As demais aparecem pelo nome, na tipografia do produto.
 */
function BrandFlag({ brand }: { brand: string }) {
  const nome = brand.trim()
  const chave = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

  if (chave.includes('master')) {
    return (
      <span className="shrink-0" title={nome}>
        <svg width="46" height="30" viewBox="0 0 46 30" aria-label={nome} role="img">
          <circle cx="18" cy="15" r="9.5" fill="#EB001B" />
          <circle cx="28" cy="15" r="9.5" fill="#F79E1B" />
          {/*
            A faixa de interseção é o que faz a marca ser reconhecida: sem ela,
            os dois círculos parecem apenas sobrepostos, e um deles some por
            baixo do outro.
          */}
          <path
            d="M23 7.9a9.5 9.5 0 0 0 0 14.2 9.5 9.5 0 0 0 0-14.2z"
            fill="#FF5F00"
          />
        </svg>
      </span>
    )
  }

  return (
    <span
      title={nome}
      className="shrink-0 text-[0.8125rem] font-semibold tracking-[0.06em] uppercase opacity-90"
    >
      {nome}
    </span>
  )
}
