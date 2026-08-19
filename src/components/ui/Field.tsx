import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/cn'

const CONTROL_BASE =
  'w-full rounded-sm bg-sunken px-4 text-[0.8125rem] text-ink border border-transparent ' +
  'placeholder:text-faint transition-colors duration-150 ' +
  'focus:bg-sheet focus:border-hairline-strong ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

interface FieldProps {
  label: string
  hint?: string
  error?: string
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
  className?: string
}

/**
 * Rótulo, controle e mensagem, ligados por id.
 *
 * O render-prop existe para que o `id` gerado chegue ao controle sem que cada
 * formulário invente o seu — `htmlFor` quebrado é um erro que não aparece na
 * tela e só se manifesta no leitor de tela.
 */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const hasMessage = Boolean(error || hint)

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      {children({ id, describedBy: hasMessage ? messageId : undefined, invalid: Boolean(error) })}
      {hasMessage ? (
        <p
          id={messageId}
          className={cn(
            'text-xs',
            // Sem vermelho: o erro se anuncia pelo ícone e pelo peso da tinta.
            error ? 'flex items-center gap-1.5 font-medium text-ink' : 'text-faint',
          )}
        >
          {error ? <Icon name="circle-alert" size={13} /> : null}
          {error || hint}
        </p>
      ) : null}
    </div>
  )
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export function TextInput({ invalid, className, ...props }: TextInputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, 'h-11', invalid && 'border-ink bg-sheet', className)}
      {...props}
    />
  )
}

/**
 * Campo de valor monetário. Aceita vírgula e ponto, alinha à direita e usa a
 * face tabular — a mesma do restante dos valores, para que o número digitado
 * pareça o número que vai aparecer na tabela.
 */
export function MoneyInput({ invalid, className, ...props }: TextInputProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[0.8125rem] font-medium text-faint">
        R$
      </span>
      <input
        inputMode="decimal"
        placeholder="0,00"
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          'tnum h-11 pr-4 pl-11 text-right font-mono',
          invalid && 'border-ink bg-sheet',
          className,
        )}
        {...props}
      />
    </div>
  )
}

interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

/**
 * Seletor sobre o `<select>` nativo.
 *
 * Continua nativo de propósito: a lista aberta é a do sistema, que no celular
 * vira a roda de rolagem que a pessoa já sabe usar, e no teclado responde a
 * busca por letra sem que ninguém precise reimplementar isso. O que se estiliza
 * é o gatilho.
 *
 * O gatilho **responde ao mouse**, e não só ao foco. Um controle que abre uma
 * lista inteira ao ser clicado e não reage à passagem do cursor parece
 * decoração desligada — a resposta é o que diz que ali se clica, antes de
 * qualquer clique acontecer.
 */
export function SelectInput({ invalid, className, children, ...props }: SelectInputProps) {
  return (
    <div className="group relative">
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          'h-11 cursor-pointer appearance-none pr-10',
          // Só a borda muda no hover, e não o fundo: no tema escuro o
          // Erguido é mais **escuro** que o Rebaixado, então clarear no claro e
          // escurecer no escuro faria o campo sumir contra a folha justamente
          // quando o cursor chega. A borda cresce igual nos dois temas.
          'hover:border-hairline-strong',
          invalid && 'border-ink',
          className,
        )}
        {...props}
      >
        {children}
      </select>

      {/*
        A seta acompanha o estado do gatilho: apagada em repouso, tinta cheia
        quando o cursor chega. Ela é o único aviso visual de que existe uma
        lista atrás, então deixá-la sempre no mesmo cinza gasta a única deixa
        que o controle tem.
      */}
      <Icon
        name="chevron-down"
        size={14}
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-faint transition-colors duration-150 group-hover:text-ink group-focus-within:text-ink"
      />
    </div>
  )
}

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function SearchInput({ label, className, ...props }: SearchInputProps) {
  return (
    <div className="relative">
      <Icon
        name="search"
        size={15}
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint"
      />
      <input
        type="search"
        aria-label={label}
        className={cn(CONTROL_BASE, 'h-11 pl-11', className)}
        {...props}
      />
    </div>
  )
}
