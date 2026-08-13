import { describe, expect, it } from 'vitest'
import {
  codigoCompleto,
  ehConflitoDeFator,
  mapEnrollError,
  mapTwoFactorError,
  normalizarCodigo,
} from './twoFactorRules'

describe('normalizarCodigo', () => {
  /*
   * Gerenciador de senhas e aplicativo autenticador costumam copiar o código
   * como "123 456". Colar isso num campo que só aceita dígito e recusa o
   * resto daria "Código incorreto" para um código que estava certo.
   */
  it('aceita o código colado com espaço, traço ou ponto', () => {
    expect(normalizarCodigo('123 456')).toBe('123456')
    expect(normalizarCodigo('123-456')).toBe('123456')
    expect(normalizarCodigo(' 123.456 ')).toBe('123456')
  })

  it('descarta letras em vez de deixar passar', () => {
    expect(normalizarCodigo('12a3b45')).toBe('12345')
  })

  it('corta no sexto dígito', () => {
    expect(normalizarCodigo('1234567890')).toBe('123456')
  })

  // O código pode começar com zero, e um `type="number"` comeria esse zero.
  it('preserva zero à esquerda', () => {
    expect(normalizarCodigo('000123')).toBe('000123')
    expect(codigoCompleto('000123')).toBe(true)
  })

  it('devolve vazio sem nenhum dígito', () => {
    expect(normalizarCodigo('abc')).toBe('')
  })
})

describe('codigoCompleto', () => {
  it('exige exatamente seis dígitos', () => {
    expect(codigoCompleto('12345')).toBe(false)
    expect(codigoCompleto('123456')).toBe(true)
    expect(codigoCompleto('123 456')).toBe(true)
    expect(codigoCompleto('')).toBe(false)
  })
})

describe('mapTwoFactorError', () => {
  it('distingue código errado de código expirado', () => {
    expect(mapTwoFactorError({ message: 'Invalid TOTP code entered' })).toContain('incorreto')
    expect(mapTwoFactorError({ message: 'Token has expired' })).toContain('expirou')
  })

  it('avisa quando o limite de tentativas foi atingido', () => {
    expect(mapTwoFactorError({ message: 'Request rate limit reached' })).toContain('Tentativas')
  })

  /*
   * Este é o erro que aparece quando o MFA não foi habilitado no projeto
   * Supabase. Sem uma frase própria, ele viraria "código incorreto" e mandaria
   * a pessoa conferir o aplicativo por um problema que está na configuração.
   */
  it('separa MFA desabilitado no projeto de código errado', () => {
    expect(mapTwoFactorError({ message: 'MFA is disabled for this project' })).toContain(
      'não está habilitada',
    )
  })

  it('cai numa mensagem genérica para erro desconhecido ou ausente', () => {
    expect(mapTwoFactorError({ message: 'boom' })).toContain('Não foi possível')
    expect(mapTwoFactorError(null)).toContain('Não foi possível')
  })
})

describe('mapEnrollError', () => {
  /*
   * Gerar o QR e conferir um código digitado falham por motivos diferentes.
   * Sem tabela própria, uma recusa do cadastro virava "Código incorreto" numa
   * tela onde ninguém tinha digitado código nenhum.
   */
  it('não reaproveita as frases de quem está conferindo código', () => {
    expect(mapEnrollError({ message: 'boom' })).toContain('QR code')
    expect(mapEnrollError(null)).toContain('QR code')
  })

  it('separa MFA desabilitado no projeto de qualquer outra recusa', () => {
    expect(mapEnrollError({ message: 'MFA is disabled for this project' })).toContain(
      'não está habilitada',
    )
  })

  it('nomeia o limite de fatores em vez de mandar tentar de novo', () => {
    expect(mapEnrollError({ message: 'Maximum number of factors reached' })).toContain('limite')
  })
})

describe('ehConflitoDeFator', () => {
  /*
   * Esta é a frase exata que o Supabase devolve quando existe um fator
   * pendente. Ela é o gatilho de limpar e tentar de novo, então uma mudança
   * no texto do servidor precisa quebrar aqui, e não em silêncio na tela de
   * quem está entrando.
   */
  it('reconhece a recusa por fator já existente', () => {
    expect(
      ehConflitoDeFator({ message: 'A factor with the friendly name "" for this user already exists' }),
    ).toBe(true)
  })

  // Insistir aqui não resolveria nada, e a limpeza não toca fator verificado.
  it('não confunde outras recusas com conflito', () => {
    expect(ehConflitoDeFator({ message: 'MFA is disabled for this project' })).toBe(false)
    expect(ehConflitoDeFator({ message: 'Request rate limit reached' })).toBe(false)
    expect(ehConflitoDeFator(null)).toBe(false)
  })
})
