import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * A linha de item — o componente mais repetido do sistema depois do painel.
 *
 * Ela aparece em parcelamento, assinatura, conta conectada, cartão e conexão
 * bancária, e antes desta versão cada uma dessas telas montava a própria
 * combinação de pastilha, título e valor. O desenho era quase o mesmo em
 * todas, e "quase" é o problema: a pastilha tinha 40px numa tela e 44 na
 * outra, o metadado ia em cinza aqui e em tinta ali, e nada disso era decisão
 * — era o que sobrou de escrever a mesma linha cinco vezes.
 *
 * A anatomia é fixa em quatro campos, na ordem em que se lê:
 *
 * 1. **Pastilha** — a marca da instituição, o ícone da categoria, o logo do
 *    serviço. Quadrado arredondado, nunca círculo: círculo é retrato de
 *    pessoa, e aqui nunca é uma pessoa.
 * 2. **Título**, com um distintivo de estado opcional colado nele.
 * 3. **Subtítulo** opcional — o texto cru que o banco escreveu, quando o
 *    título é uma marca reconhecida. "GOOGLE PRIME VIDEO SAO PAULO BRA" não é
 *    o que a pessoa assinou, mas é por essa linha que ela confere se a
 *    cobrança é mesmo aquela.
 * 4. **Metadados**, numa linha própria, separados por `•` — a parcela, a
 *    data, a conta. Tudo que qualifica sem ser o nome.
 * 5. **Valor** à direita, com uma legenda pequena embaixo quando o número
 *    sozinho é ambíguo ("restante", "/mês", "disponível").
 *
 * As ações ficam depois do valor, e só recuam para o hover **onde existe
 * hover**. Num aparelho de toque não há estado intermediário entre não tocar e
 * tocar: uma ação escondida atrás de hover simplesmente não existe ali. A
 * consulta `(hover: hover)` pergunta pelo apontador, e não pela largura da
 * tela — um tablet grande continua sendo toque, e uma janela estreita no
 * desktop continua tendo mouse.
 */
export function ItemRow({
  media,
  title,
  badge,
  subtitle,
  meta,
  value,
  caption,
  actions,
  trailing,
  size = 'md',
  className,
}: {
  media?: ReactNode
  title: ReactNode
  badge?: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  value?: ReactNode
  caption?: string
  actions?: ReactNode
  /**
   * O último elemento da linha, sempre à vista — ao contrário de `actions`,
   * que recua para o hover. É o lugar do controle que abre a linha: ele é a
   * porta para o detalhe, e uma porta que só aparece com o mouse em cima
   * não é achada por quem não sabe que ela existe.
   */
  trailing?: ReactNode
  /**
   * `md` é a linha dentro de um painel — contas, cartões, a lista curta da
   * Visão geral. `lg` é a linha que **é** a página: Parcelamentos e
   * Assinaturas, uma compra ou um serviço por cartão, com a tipografia do
   * produto de referência — título de 20px, subtítulo de 16, informações de
   * 14 e o valor em 22. Ali a linha não disputa espaço com painel nenhum, e
   * o texto de 13px de um painel ficava perdido no meio de um cartão largo.
   */
  size?: 'md' | 'lg'
  className?: string
}) {
  const lg = size === 'lg'

  return (
    <div
      className={cn(
        'group/row flex py-3',
        lg ? 'items-start gap-4' : 'items-center gap-3.5',
        className,
      )}
    >
      {media ? <div className="shrink-0">{media}</div> : null}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'truncate text-ink',
              lg ? 'text-xl leading-tight font-semibold' : 'text-[0.8125rem] font-medium',
            )}
          >
            {title}
          </span>
          {badge ? <span className="shrink-0">{badge}</span> : null}
        </div>
        {subtitle ? (
          <div className={cn('truncate', lg ? 'mt-1.5 text-base text-muted' : 'mt-0.5 text-xs text-faint')}>
            {subtitle}
          </div>
        ) : null}
        {meta ? (
          <div
            className={cn(
              'flex min-w-0 flex-wrap items-center text-muted',
              lg ? 'mt-2 gap-x-2.5 gap-y-1 text-sm' : 'mt-0.5 gap-x-2 gap-y-0.5 text-xs',
            )}
          >
            {meta}
          </div>
        ) : null}
      </div>

      {value ? (
        <div className="shrink-0 text-right">
          <div
            className={cn(
              'text-ink',
              lg ? 'text-[1.375rem] leading-tight font-bold' : 'text-[0.8125rem] font-semibold',
            )}
          >
            {value}
          </div>
          {caption ? (
            <div className={cn('text-muted', lg ? 'mt-1 text-sm' : 'mt-0.5 text-xs')}>{caption}</div>
          ) : null}
        </div>
      ) : null}

      {actions ? (
        <div className="shrink-0 transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/row:opacity-100 [@media(hover:hover)]:group-hover/row:opacity-100">
          {actions}
        </div>
      ) : null}

      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  )
}

/**
 * A pastilha da linha.
 *
 * `tint` recebe o matiz da categoria e desenha o glifo em preto sobre ele —
 * as oito cores de categoria foram derivadas justamente para suportar tinta
 * preta por cima (a pior delas dá 8:1). Sem `tint`, a pastilha fica na
 * superfície rebaixada com o glifo em tinta, que é o caso da instituição
 * bancária: o logo dela já traz a própria cor e a pastilha só a emoldura.
 */
export function ItemMedia({
  children,
  tint,
  ink,
  size = 40,
  className,
}: {
  children: ReactNode
  tint?: string
  /**
   * Tinta sobre o `tint`. O padrão é preto, que serve às cores de categoria —
   * todas derivadas para aguentar preto por cima. Cor de banco não foi
   * derivada por nós: o roxo do Nubank dá 2,9:1 com preto, e quem pinta com
   * ela passa a tinta que `findBankBrand` já calcula pela luminância.
   */
  ink?: string
  size?: 32 | 40 | 48
  className?: string
}) {
  return (
    <span
      style={{ width: size, height: size, backgroundColor: tint, color: tint ? ink : undefined }}
      className={cn(
        'inline-flex items-center justify-center overflow-hidden rounded-sm',
        tint ? 'text-accent-ink' : 'bg-sunken text-ink',
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * O separador entre metadados. Um ponto médio, nunca uma barra: a barra lê
 * como caminho de arquivo e a vírgula lê como continuação da frase.
 */
export function MetaDot() {
  return (
    <span aria-hidden="true" className="text-faint">
      •
    </span>
  )
}
