import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/cn'

interface SheetProps {
  children: ReactNode
  className?: string
  /** Remove o preenchimento interno, para folhas que hospedam tabela. */
  flush?: boolean
  as?: 'div' | 'section' | 'article'
  /**
   * A folha inteira abre alguma coisa — a assinatura, o cartão.
   *
   * Conveniência de mouse, nunca o único caminho: quem passa isto deixa
   * dentro da folha um botão de verdade com o mesmo destino, que é por onde
   * o teclado e o leitor de tela entram. Uma folha que só abre no clique
   * seria uma porta invisível para eles.
   */
  onClick?: () => void
}

/**
 * A folha: o painel branco apoiado sobre a mesa.
 *
 * A sombra tem duas camadas de propósito. A curta é o contato — o escurecimento
 * logo abaixo da borda, onde o papel encosta. A longa é a difusão. Uma sombra
 * de camada única fica ou dura demais ou vaga demais; é a soma das duas que
 * lê como objeto apoiado em vez de retângulo com efeito.
 */
export function Card({ children, className, flush = false, as: Tag = 'div', onClick }: SheetProps) {
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'rounded-lg border border-hairline bg-sheet shadow-[var(--shadow-sheet)]',
        !flush && 'p-6',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

/**
 * O painel de aviso.
 *
 * Num sistema sem cor, um retângulo preenchido era o evento mais alto
 * disponível, e a Regra do Alerta Invertido reservava a inversão a uma
 * condição só. Em fundo preto isso deixou de funcionar: `--block` agora é
 * claro, e um painel de aviso branco no meio de painéis escuros não lê como
 * urgência — lê como um card que esqueceram de estilizar.
 *
 * O aviso passa a ser **tingido**: a superfície e a borda recebem 10% e 25%
 * da própria cor do estado, e o texto vai na cor cheia. É o que o produto de
 * referência faz com o aviso de fatura estimada, e resolve o que a inversão
 * resolvia — destacar sem sair do sistema — sem gastar o contraste máximo da
 * tela num alerta que pode aparecer três vezes no mesmo mês.
 */
type NoticeTone = 'attention' | 'expense' | 'accent'

const NOTICE_TONE: Record<NoticeTone, string> = {
  attention: 'border-attention/25 bg-attention/10 text-attention',
  expense: 'border-expense/25 bg-expense/10 text-expense',
  accent: 'border-accent/25 bg-accent/10 text-accent',
}

export function NoticePanel({
  children,
  tone = 'attention',
  className,
  flush = false,
  as: Tag = 'div',
}: SheetProps & { tone?: NoticeTone }) {
  return (
    <Tag className={cn('rounded-lg border', NOTICE_TONE[tone], !flush && 'p-6', className)}>
      {children}
    </Tag>
  )
}

interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** Usa a tinta invertida, para cabeçalhos dentro de um bloco. */
  onBlock?: boolean
  className?: string
}

/**
 * Cabeçalho de painel.
 *
 * O título vai em **caixa alta**, corpo pequeno e cinza, com tracking aberto —
 * e isso reverte uma regra nomeada do sistema antigo ("Label: caixa normal,
 * nunca versalete espaçada").
 *
 * A regra fazia sentido quando o título era a coisa mais escura de uma folha
 * branca e precisava competir com o corpo do texto pela atenção. Aqui o painel
 * é escuro e a figura logo abaixo é enorme: o título disputando com ela em
 * caixa normal e peso semibold só embaça a hierarquia. Em caixa alta e cinza
 * ele vira o que de fato é — a etiqueta que diz de que painel se trata — e o
 * número fica sendo o que se lê.
 */
export function CardHeader({
  title,
  description,
  action,
  onBlock = false,
  className,
}: CardHeaderProps) {
  return (
    <div className={cn('mb-5 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2
          className={cn(
            'text-xs font-medium tracking-[0.06em] uppercase',
            onBlock ? 'text-block-muted' : 'text-muted',
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className={cn('mt-1 text-xs', onBlock ? 'text-block-muted' : 'text-muted')}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1.5">{action}</div> : null}
    </div>
  )
}

/**
 * Agrupamento interno. Usa a superfície rebaixada em vez de uma segunda folha:
 * folha dentro de folha é proibido pelo sistema.
 */
export function CardWell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-md bg-sunken p-4', className)}>{children}</div>
}

/**
 * O link do canto do painel — "ver todas", "ver mais".
 *
 * É a única coisa colorida num cabeçalho de painel, e por isso ela carrega
 * uma regra: **um por painel**. O acento aqui não está dizendo "positivo", e
 * sim "há mais coisa por este caminho"; dois deles no mesmo cabeçalho fazem o
 * olho escolher entre dois destinos quando a leitura seguinte deveria ser o
 * número logo abaixo.
 *
 * A seta é `↗` e não `→`: ela sai da caixa, não avança na linha, e é assim
 * que o produto de referência a desenha.
 */
export function CardLink({
  to,
  children,
  className,
}: {
  to: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-accent',
        'transition-opacity duration-150 hover:opacity-80',
        className,
      )}
    >
      {children}
      <Icon name="arrow-up-right" size={13} strokeWidth={2.25} aria-hidden="true" />
    </Link>
  )
}

/**
 * O rodapé de um painel: um resumo curto depois de uma hairline.
 *
 * É o único divisor que o sistema gasta dentro de um painel, e ele se paga —
 * separa o total da lista que o produziu, que é exatamente a leitura que o
 * espaço sozinho não consegue dar quando a lista já é uma pilha de linhas
 * espaçadas.
 */
export function CardFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mt-4 flex items-center justify-between gap-3 border-t border-hairline pt-4 text-xs text-muted',
        className,
      )}
    >
      {children}
    </div>
  )
}
