import { describe, expect, it } from 'vitest'
import type { Profile, Transaction } from '@/domain/types'
import { callNameOf, dueTodayText, greetingFor, greetingTextFor } from './Greeting'

function perfil(over: Partial<Profile> = {}): Profile {
  return {
    name: '',
    nickname: '',
    avatar: { image: '1', shape: 'circle' },
    greeting: true,
    onboardedAt: null,
    ...over,
  }
}

/**
 * Os cortes são os do português falado no Brasil, e não os de outro idioma:
 * traduzir "good evening" daria "boa tarde" às vinte horas.
 */
describe('greetingFor', () => {
  it('cumprimenta pela faixa do dia', () => {
    expect(greetingFor(0)).toBe('Bom dia')
    expect(greetingFor(11)).toBe('Bom dia')
    expect(greetingFor(12)).toBe('Boa tarde')
    expect(greetingFor(17)).toBe('Boa tarde')
    expect(greetingFor(18)).toBe('Boa noite')
    expect(greetingFor(23)).toBe('Boa noite')
  })
})

describe('callNameOf', () => {
  it('prefere o apelido ao primeiro nome', () => {
    expect(callNameOf(perfil({ name: 'Otávio de Souza Oliveira', nickname: 'Tavo' }))).toBe('Tavo')
  })

  it('cai no primeiro nome quando não há apelido', () => {
    expect(callNameOf(perfil({ name: 'Otávio de Souza Oliveira' }))).toBe('Otávio')
  })

  it('devolve vazio sem nome nenhum', () => {
    expect(callNameOf(perfil())).toBe('')
  })
})

describe('greetingTextFor', () => {
  it('monta a saudação com o nome de chamada', () => {
    expect(greetingTextFor(perfil({ name: 'Otávio Oliveira' }), 9)).toBe('Bom dia, Otávio!')
    expect(greetingTextFor(perfil({ name: 'Otávio', nickname: 'Tavo' }), 20)).toBe('Boa noite, Tavo!')
  })

  it('cumprimenta sem nome quando não há um', () => {
    expect(greetingTextFor(perfil(), 14)).toBe('Boa tarde!')
  })

  it('devolve vazio com a saudação desligada, para o painel voltar a se chamar Painel', () => {
    expect(greetingTextFor(perfil({ name: 'Otávio', greeting: false }), 9)).toBe('')
  })
})

function lancamento(over: Partial<Transaction> = {}): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    kind: 'expense',
    description: 'Conta de luz',
    amountCents: 10_000,
    date: '2026-08-08',
    categoryId: 'moradia',
    source: 'manual',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }
}

describe('dueTodayText', () => {
  it('diz que nada vence quando o dia está livre', () => {
    expect(dueTodayText([lancamento({ date: '2026-08-20' })], '2026-08-08')).toBe(
      'Nada vence hoje',
    )
  })

  it('concorda o verbo com a contagem', () => {
    expect(dueTodayText([lancamento()], '2026-08-08')).toBe('1 lançamento vence hoje')
    expect(dueTodayText([lancamento(), lancamento()], '2026-08-08')).toBe(
      '2 lançamentos vencem hoje',
    )
  })

  // Receita cai na conta, não vence. Contá-la transformaria um dia de salário
  // em aviso de cobrança.
  it('ignora receita', () => {
    expect(dueTodayText([lancamento({ kind: 'income' })], '2026-08-08')).toBe('Nada vence hoje')
  })
})
