import { useState } from 'react'
import { cn } from '@/lib/cn'

export interface Ponto {
  id: string
  label: string
  count: number
}

const ALTURA_PLOT = 104

/**
 * Figura grande com a série em degraus embaixo.
 *
 * O acumulado tem um valor que interessa acima de todos, o de hoje, e uma
 * forma que interessa depois dele. Por isso a figura vem primeiro e grande, e
 * o desenho vira o rodapé do cartão: quem só quer o número lê numa fixação, e
 * quem quer o caminho tem o caminho.
 *
 * Degrau, e não reta ligando os pontos. Um total acumulado não cresce ao longo
 * do mês, ele salta quando uma conta é criada e fica parado até a próxima.
 * A reta diagonal desenharia um crescimento contínuo que não aconteceu, e é
 * uma das mentiras mais fáceis de contar com um gráfico de linha.
 *
 * Sem eixo vertical e sem grade: o valor exato vem da figura, do rótulo do
 * último ponto e do balão. Rédea de escala num desenho de 104px seria mais
 * mobília do que dado.
 */
export function StepAreaChart({
  pontos,
  unidade,
}: {
  pontos: Ponto[]
  unidade: { singular: string; plural: string }
}) {
  const [ativo, setAtivo] = useState<number | null>(null)

  const ultimo = pontos.length - 1
  const emFoco = ativo ?? ultimo
  const atual = pontos[emFoco]
  const anterior = emFoco > 0 ? pontos[emFoco - 1] : null
  const variacao = anterior ? atual.count - anterior.count : atual.count

  // Teto com folga: a linha encostando na borda de cima não tem para onde
  // crescer visualmente, e a leitura fica sem respiro.
  const pico = Math.max(1, ...pontos.map((ponto) => ponto.count))
  const max = pico + Math.max(1, Math.round(pico * 0.15))

  /*
   * Cada mês ocupa uma faixa inteira, e o degrau atravessa a faixa na altura
   * daquele mês. Por isso a série vira dois pontos por mês (entrada e saída da
   * faixa) em vez de um: é o que transforma a poligonal em escada.
   */
  const largura = 100 / pontos.length
  const vertices = pontos.flatMap((ponto, indice) => {
    const y = (1 - ponto.count / max) * 100
    return [
      { x: indice * largura, y },
      { x: (indice + 1) * largura, y },
    ]
  })

  const linha = vertices.map((vertice) => `${vertice.x},${vertice.y}`).join(' ')
  const area = `0,100 ${linha} 100,100`

  /** Centro horizontal da faixa em foco, em porcentagem do desenho. */
  const ancora = (emFoco + 0.5) * largura

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-2.5">
        {/*
          Display prosa (2,125rem), e não a Figura de 2,75rem em Figtree: a
          Figura veste a face da marca e é reservada ao número que a tela
          inteira existe para mostrar. Aqui é o número de um cartão entre
          outros, e o painel de administração não tem nenhuma outra figura com
          que dividir esse peso.
        */}
        <p className="text-[2.125rem] leading-none font-semibold tracking-[-0.03em] text-ink">
          {atual.count}
        </p>
        <p className="text-xs text-muted">
          {atual.count === 1 ? unidade.singular : unidade.plural} até {atual.label}
        </p>
      </div>

      <p className="mt-1.5 text-xs text-faint">
        {variacao > 0
          ? `${variacao} ${variacao === 1 ? 'nova' : 'novas'} neste mês`
          : 'Nenhuma nova neste mês'}
      </p>

      <div
        className="relative mt-6"
        style={{ height: ALTURA_PLOT }}
        onPointerLeave={() => setAtivo(null)}
      >
        {/*
          A faixa acesa fica atrás do desenho: acesa por cima, ela lavaria a
          própria linha que se está tentando ler. Ela existe porque a leitura
          acontece onde o cursor está, e a figura lá em cima, a 100px do
          ponteiro, é longe demais para ser percebida como resposta ao gesto.
        */}
        {ativo !== null ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 bg-sunken/70"
            style={{ left: `${ativo * largura}%`, width: `${largura}%` }}
          />
        ) : null}

        {/*
          `preserveAspectRatio="none"` estica a caixa de coordenadas até o
          tamanho real, e é o que deixa o desenho acompanhar a largura do
          cartão sem recalcular nada em JavaScript. `vector-effect` é o par
          obrigatório disso: sem ele a deformação engrossaria o traço na
          horizontal e o afinaria na vertical.
        */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden="true"
        >
          <polygon points={area} className="fill-ink opacity-[0.07]" />
          <polyline
            points={linha}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="miter"
            vectorEffect="non-scaling-stroke"
            className="stroke-ink"
          />
        </svg>

        {/* A base fecha o desenho contra o cartão, no lugar de uma grade. */}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 border-t border-hairline" />

        {/* O fio liga o patamar à base e ancora a faixa acesa na data. */}
        {ativo !== null ? (
          <span
            aria-hidden="true"
            className="absolute w-px bg-hairline-strong"
            style={{ left: `${ancora}%`, top: `${(1 - atual.count / max) * 100}%`, bottom: 0 }}
          />
        ) : null}

        {/*
          Marcador no meio da faixa em foco, e não no vértice: num degrau o
          vértice é o instante da mudança, e o que se está lendo é o patamar do
          mês inteiro.
        */}
        <span
          aria-hidden="true"
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-sheet motion-safe:transition-all motion-safe:duration-200"
          style={{ left: `${ancora}%`, top: `${(1 - atual.count / max) * 100}%` }}
        />

        {/*
          O balão fica preso ao topo do desenho, e não colado ao ponto: num
          degrau o ponto sobe e desce a cada mês, e um balão que o acompanhasse
          ficaria pulando pela vertical a cada movimento do cursor.
        */}
        {ativo !== null ? (
          <div
            role="status"
            className={cn(
              'pointer-events-none absolute top-0 z-10 rounded-sm border border-hairline bg-sheet px-2.5 py-1.5 shadow-[var(--shadow-float)]',
              // Nos extremos o balão encosta na borda em vez de centralizar:
              // centralizado, o primeiro e o último mês jogariam metade da
              // caixa para fora do cartão.
              ancora < 15 ? 'translate-x-0' : ancora > 85 ? '-translate-x-full' : '-translate-x-1/2',
            )}
            style={{ left: `${ancora}%` }}
          >
            <p className="tnum text-xs font-semibold whitespace-nowrap text-ink">
              {atual.count} {atual.count === 1 ? unidade.singular : unidade.plural}
            </p>
            <p className="text-[0.625rem] whitespace-nowrap text-muted">{atual.label}</p>
          </div>
        ) : null}

        <ul className="absolute inset-0 flex">
          {pontos.map((ponto, indice) => (
            <li key={ponto.id} className="flex-1">
              <button
                type="button"
                onPointerEnter={() => setAtivo(indice)}
                onFocus={() => setAtivo(indice)}
                onBlur={() => setAtivo(null)}
                aria-label={`${ponto.label}: ${ponto.count} ${ponto.count === 1 ? unidade.singular : unidade.plural}`}
                className="size-full rounded-sm outline-offset-2"
              />
            </li>
          ))}
        </ul>
      </div>

      {/*
        Extremos apenas. Um rótulo por mês exigiria rotacionar o texto assim
        que a série passasse de um ano, e a pergunta que este desenho responde
        é de onde até onde, não mês a mês.
      */}
      <div className="mt-2 flex justify-between text-[0.625rem] text-faint" aria-hidden="true">
        <span>{pontos[0].label}</span>
        <span>{pontos[ultimo].label}</span>
      </div>
    </div>
  )
}
