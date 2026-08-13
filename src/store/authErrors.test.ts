import { describe, expect, it } from 'vitest'
import { mapAuthError } from './authErrors'

describe('mapAuthError', () => {
  it('traduz credenciais inválidas', () => {
    expect(mapAuthError({ message: 'Invalid login credentials' })).toBe('E-mail ou senha incorretos.')
  })

  it('traduz conta não confirmada', () => {
    expect(mapAuthError({ message: 'Email not confirmed' })).toBe(
      'Esta conta ainda não foi confirmada.',
    )
  })

  it('traduz conta desativada, em qualquer variação de wording da SDK', () => {
    expect(mapAuthError({ message: 'User is banned' })).toBe(
      'Esta conta foi desativada. Fale com um administrador.',
    )
    expect(mapAuthError({ message: 'User is disabled' })).toBe(
      'Esta conta foi desativada. Fale com um administrador.',
    )
  })

  it('cai numa mensagem genérica para erro desconhecido', () => {
    expect(mapAuthError({ message: 'Something exploded' })).toBe(
      'Não foi possível entrar. Tente novamente.',
    )
  })

  it('cai na mesma mensagem genérica sem erro nenhum', () => {
    expect(mapAuthError(null)).toBe('Não foi possível entrar. Tente novamente.')
    expect(mapAuthError(undefined)).toBe('Não foi possível entrar. Tente novamente.')
  })
})
