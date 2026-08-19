import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/cn'

/**
 * Seletor com lista própria, no lugar da lista do sistema operacional.
 *
 * O `<select>` nativo tem um limite que nenhum CSS contorna: a lista aberta é
 * desenhada pelo sistema, então ela chega branca com realce azul do Windows no
 * meio de um produto que é todo tinta e papel. Era o único lugar do aplicativo
 * onde o desenho parava na borda do componente.
 *
 * Trocar o nativo tem um custo, e ele é pago aqui e não deixado para quem usa:
 * teclado completo (setas, Home, End, Enter, Esc e busca digitando), semântica
 * de `combobox` e `listbox` para leitor de tela, fechamento ao clicar fora, e
 * abertura para cima quando não há espaço embaixo. Um seletor bonito que não
 * responde ao teclado é uma regressão, não um refinamento.
 */

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: readonly SelectOption[]
  id?: string
  'aria-label'?: string
  'aria-describedby'?: string
  invalid?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
}

/** Por quanto tempo a digitação continua contando como a mesma busca. */
const JANELA_DE_BUSCA_MS = 600

/** Altura mínima que a lista precisa embaixo para não abrir para cima. */
const ESPACO_MINIMO = 240

export function Select({
  value,
  onChange,
  options,
  id,
  invalid,
  disabled,
  placeholder = 'Selecione',
  className,
  ...aria
}: SelectProps) {
  const [aberto, setAberto] = useState(false)
  const [emFoco, setEmFoco] = useState(0)
  const [paraCima, setParaCima] = useState(false)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const gatilhoRef = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)
  const buscaRef = useRef({ texto: '', em: 0 })

  const gerado = useId()
  const listaId = `${gerado}-lista`

  const selecionada = useMemo(
    () => options.find((opcao) => opcao.value === value),
    [options, value],
  )

  const abrir = () => {
    if (disabled) return

    /*
     * A direção é decidida na abertura, medindo o espaço real embaixo do
     * gatilho. Abrir sempre para baixo joga a lista para fora da tela quando o
     * campo está no rodapé, e aí a pessoa vê metade das opções sem saber que
     * existem mais.
     */
    const caixa = gatilhoRef.current?.getBoundingClientRect()
    if (caixa) {
      const espacoAbaixo = window.innerHeight - caixa.bottom
      setParaCima(espacoAbaixo < ESPACO_MINIMO && caixa.top > espacoAbaixo)
    }

    // Abre com o foco na opção atual, e não no topo: quem abre um seletor já
    // preenchido quase sempre procura o vizinho do que está escolhido.
    const atual = options.findIndex((opcao) => opcao.value === value)
    setEmFoco(atual >= 0 ? atual : 0)
    setAberto(true)
  }

  const fechar = (devolverFoco = true) => {
    setAberto(false)
    // Devolver o foco é o que permite continuar navegando por teclado do ponto
    // onde se estava, em vez de voltar para o início do documento.
    if (devolverFoco) gatilhoRef.current?.focus()
  }

  const escolher = (indice: number) => {
    const opcao = options[indice]
    if (!opcao || opcao.disabled) return
    onChange(opcao.value)
    fechar()
  }

  // Fecha ao clicar fora. Sem isto o painel fica pendurado sobre a tela e
  // acompanha a rolagem como se fizesse parte dela.
  useEffect(() => {
    if (!aberto) return

    const aoClicar = (evento: MouseEvent) => {
      if (!wrapperRef.current?.contains(evento.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicar)
    return () => document.removeEventListener('mousedown', aoClicar)
  }, [aberto])

  // Mantém visível a opção em foco quando a navegação por teclado passa do fim
  // da área que a lista mostra.
  useEffect(() => {
    if (!aberto) return
    const item = listaRef.current?.children[emFoco] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [aberto, emFoco])

  /** Busca por digitação, como o seletor nativo faz. */
  const buscar = (tecla: string) => {
    const agora = Date.now()
    const busca = buscaRef.current
    busca.texto = agora - busca.em > JANELA_DE_BUSCA_MS ? tecla : busca.texto + tecla
    busca.em = agora

    const alvo = busca.texto.toLowerCase()
    const encontrado = options.findIndex((opcao) => opcao.label.toLowerCase().startsWith(alvo))
    if (encontrado >= 0) setEmFoco(encontrado)
  }

  const aoTeclar = (evento: React.KeyboardEvent) => {
    if (disabled) return

    if (!aberto) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(evento.key)) {
        evento.preventDefault()
        abrir()
      }
      return
    }

    switch (evento.key) {
      case 'Escape':
        evento.preventDefault()
        fechar()
        break
      case 'Tab':
        // Tab confirma e sai, que é o que o seletor nativo faz.
        fechar(false)
        break
      case 'Enter':
      case ' ':
        evento.preventDefault()
        escolher(emFoco)
        break
      case 'ArrowDown':
        evento.preventDefault()
        setEmFoco((atual) => Math.min(atual + 1, options.length - 1))
        break
      case 'ArrowUp':
        evento.preventDefault()
        setEmFoco((atual) => Math.max(atual - 1, 0))
        break
      case 'Home':
        evento.preventDefault()
        setEmFoco(0)
        break
      case 'End':
        evento.preventDefault()
        setEmFoco(options.length - 1)
        break
      default:
        if (evento.key.length === 1) buscar(evento.key)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={gatilhoRef}
        type="button"
        id={id}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-haspopup="listbox"
        aria-invalid={invalid || undefined}
        aria-label={aria['aria-label']}
        aria-describedby={aria['aria-describedby']}
        disabled={disabled}
        onClick={() => (aberto ? fechar(false) : abrir())}
        onKeyDown={aoTeclar}
        className={cn(
          'flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-sm border border-transparent bg-sunken px-4 text-left text-[0.8125rem] text-ink',
          'transition-colors duration-150 hover:border-hairline-strong',
          'disabled:cursor-not-allowed disabled:opacity-50',
          aberto && 'border-hairline-strong bg-sheet',
          invalid && 'border-ink',
          className,
        )}
      >
        <span className={cn('truncate', !selecionada && 'text-faint')}>
          {selecionada?.label ?? placeholder}
        </span>
        <Icon
          name="chevron-down"
          size={14}
          className={cn(
            'shrink-0 text-faint transition-transform duration-200',
            aberto && 'rotate-180 text-ink',
          )}
        />
      </button>

      {aberto ? (
        <ul
          ref={listaRef}
          id={listaId}
          role="listbox"
          aria-activedescendant={`${listaId}-${emFoco}`}
          tabIndex={-1}
          className={cn(
            // `scroll-py-1` faz o rolamento automático parar respeitando o
            // respiro da lista: sem isso a opção que entra em foco encosta na
            // borda e a de cima aparece cortada ao meio, com cara de erro de
            // renderização.
            'absolute z-30 max-h-60 w-full scroll-py-1 overflow-y-auto rounded-md border border-hairline bg-raised p-1 shadow-float',
            paraCima ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {options.map((opcao, indice) => {
            const escolhida = opcao.value === value

            return (
              <li
                key={opcao.value}
                id={`${listaId}-${indice}`}
                role="option"
                aria-selected={escolhida}
                aria-disabled={opcao.disabled || undefined}
                onMouseEnter={() => setEmFoco(indice)}
                onMouseDown={(evento) => evento.preventDefault()}
                onClick={() => escolher(indice)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-xs px-3 py-2 text-[0.8125rem] transition-colors duration-100',
                  opcao.disabled && 'cursor-not-allowed opacity-45',
                  indice === emFoco && !opcao.disabled ? 'bg-block text-block-ink' : 'text-ink',
                )}
              >
                <span className="truncate">{opcao.label}</span>
                {/*
                  O visto marca a escolhida mesmo quando o cursor está em outra
                  linha. Sem ele, mover o mouse apaga a única pista de qual
                  valor está valendo agora.
                */}
                {escolhida ? <Icon name="check" size={13} className="shrink-0" /> : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
