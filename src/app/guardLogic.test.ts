import { describe, expect, it } from 'vitest'
import { resolveGuardOutcome } from './guardLogic'

describe('resolveGuardOutcome', () => {
  it('espera enquanto a sessão ainda está carregando, para qualquer papel exigido', () => {
    expect(resolveGuardOutcome({ status: 'loading', role: null }, 'user')).toBe('loading')
    expect(resolveGuardOutcome({ status: 'loading', role: null }, 'admin')).toBe('loading')
  })

  it('manda pro login sem sessão, para qualquer papel exigido', () => {
    expect(resolveGuardOutcome({ status: 'signedOut', role: null }, 'user')).toBe('redirect-login')
    expect(resolveGuardOutcome({ status: 'signedOut', role: null }, 'admin')).toBe('redirect-login')
  })

  /*
   * Senha aceita e segundo fator pendente é o estado mais perigoso de errar:
   * tratá-lo como "entrou" abriria o app inteiro para quem só passou pela
   * primeira metade da autenticação.
   */
  it('barra quem passou pela senha mas ainda não pelo segundo fator', () => {
    expect(resolveGuardOutcome({ status: 'mfaRequired', role: null }, 'user')).toBe('redirect-login')
    expect(resolveGuardOutcome({ status: 'mfaRequired', role: null }, 'admin')).toBe('redirect-login')
    // Mesmo com papel já conhecido, o acesso continua barrado.
    expect(resolveGuardOutcome({ status: 'mfaRequired', role: 'admin' }, 'admin')).toBe(
      'redirect-login',
    )
  })

  it('libera quando o papel da sessão bate com o exigido', () => {
    expect(resolveGuardOutcome({ status: 'signedIn', role: 'user' }, 'user')).toBe('allow')
    expect(resolveGuardOutcome({ status: 'signedIn', role: 'admin' }, 'admin')).toBe('allow')
  })

  it('manda o admin para o próprio painel ao tentar entrar em rota de usuário', () => {
    expect(resolveGuardOutcome({ status: 'signedIn', role: 'admin' }, 'user')).toBe(
      'redirect-admin-home',
    )
  })

  it('manda o usuário para o painel financeiro ao tentar entrar em rota de admin', () => {
    expect(resolveGuardOutcome({ status: 'signedIn', role: 'user' }, 'admin')).toBe(
      'redirect-user-home',
    )
  })
})
