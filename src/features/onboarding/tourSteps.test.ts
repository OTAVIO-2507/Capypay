import { describe, expect, it } from 'vitest'
import { ADMIN_NAV, ADMIN_SETTINGS_NAV } from '@/app/adminNavigation'
import { PRIMARY_NAV, SETTINGS_NAV } from '@/app/navigation'
import { ADMIN_TOUR_STEPS } from './adminTourSteps'
import {
  BALLOON_ESTIMATED_HEIGHT,
  BALLOON_WIDTH,
  placeBalloon,
  TOUR_STEPS,
  type Rect,
  type Viewport,
} from './tourSteps'

const JANELA: Viewport = { width: 1440, height: 900 }

function alvo(over: Partial<Rect> = {}): Rect {
  return { top: 100, left: 600, width: 200, height: 44, ...over }
}

describe('placeBalloon', () => {
  it('encosta abaixo do alvo quando há espaço', () => {
    const { side, top } = placeBalloon(alvo(), JANELA)
    expect(side).toBe('below')
    expect(top).toBeGreaterThan(100 + 44)
  })

  it('vira para cima quando o alvo está no rodapé', () => {
    // O caso da barra de navegação inferior no celular: sem a inversão, o
    // balão nasceria fora da tela e o passo ficaria ilegível.
    const { side, top } = placeBalloon(alvo({ top: 840, height: 60 }), JANELA)
    expect(side).toBe('above')
    expect(top).toBeLessThan(840)
    expect(top).toBeGreaterThanOrEqual(16)
  })

  it('centraliza no alvo quando cabe', () => {
    const { left } = placeBalloon(alvo({ left: 600, width: 200 }), JANELA)
    expect(left).toBe(700 - BALLOON_WIDTH / 2)
  })

  it('prende na margem esquerda em vez de vazar', () => {
    const { left } = placeBalloon(alvo({ left: 0, width: 40 }), JANELA)
    expect(left).toBeGreaterThanOrEqual(16)
  })

  it('prende na margem direita em vez de vazar', () => {
    const { left } = placeBalloon(alvo({ left: 1400, width: 40 }), JANELA)
    expect(left + BALLOON_WIDTH).toBeLessThanOrEqual(JANELA.width)
  })

  it('cabe em tela estreita sem left negativo', () => {
    const estreita: Viewport = { width: 360, height: 740 }
    const { left } = placeBalloon(alvo({ left: 10, width: 340 }), estreita)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(left).toBeLessThan(estreita.width)
  })

  it('nunca sobe acima do topo, mesmo com alvo colado no topo e sem espaço abaixo', () => {
    const baixa: Viewport = { width: 1440, height: 260 }
    const { top } = placeBalloon(alvo({ top: 4, height: 40 }), baixa, BALLOON_ESTIMATED_HEIGHT)
    expect(top).toBeGreaterThanOrEqual(16)
  })
})

describe('TOUR_STEPS', () => {
  it('todo passo tem ao menos um alvo candidato', () => {
    for (const passo of TOUR_STEPS) {
      expect(passo.targets.length).toBeGreaterThan(0)
    }
  })

  /*
   * O passo de lançamento é o único com dois candidatos, e é proposital: numa
   * conta nova o painel mostra a tela de boas-vindas, e o botão "Novo
   * lançamento" do cabeçalho sequer existe no DOM. Sem o segundo candidato, o
   * passo mais importante do tour seria descartado justamente para quem está
   * entrando pela primeira vez — que é o único público dele.
   */
  it('o passo de lançamento cobre a conta vazia e a conta com histórico', () => {
    const lancamento = TOUR_STEPS.find((passo) => passo.targets.includes('new-transaction'))
    expect(lancamento?.targets).toContain('welcome-first-transaction')
  })
})

/*
 * Um destino sem parada no tour é uma tela que a pessoa só descobre por
 * acidente, e foi exatamente assim que o roteiro do usuário nasceu: pulando
 * Transações, Contas e Ajustes. Amarrar o roteiro à navegação faz o próximo
 * destino que alguém acrescentar quebrar aqui, em vez de sumir em silêncio.
 */
function cobreTodaANavegacao(
  passos: readonly { targets: readonly string[] }[],
  destinos: readonly { tour?: string }[],
) {
  const cobertos = new Set(passos.flatMap((passo) => passo.targets))
  return destinos
    .map((destino) => destino.tour)
    .filter((alvo): alvo is string => Boolean(alvo))
    .filter((alvo) => !cobertos.has(alvo))
}

describe('cobertura dos roteiros', () => {
  it('o tour do usuário passa por todos os destinos da barra', () => {
    expect(cobreTodaANavegacao(TOUR_STEPS, [...PRIMARY_NAV, SETTINGS_NAV])).toEqual([])
  })

  it('o tour do admin passa por todos os destinos da barra', () => {
    expect(cobreTodaANavegacao(ADMIN_TOUR_STEPS, [...ADMIN_NAV, ADMIN_SETTINGS_NAV])).toEqual([])
  })

  it('todo passo do admin tem ao menos um alvo candidato', () => {
    for (const passo of ADMIN_TOUR_STEPS) {
      expect(passo.targets.length).toBeGreaterThan(0)
    }
  })
})
