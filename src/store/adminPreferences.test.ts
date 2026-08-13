import { beforeEach, describe, expect, it } from 'vitest'
import { useAdminPreferences } from './adminPreferences'

/**
 * As preferências de administração moram no navegador, não no servidor, então
 * são elas que precisam saber de quem são. Duas contas de administração no
 * mesmo computador é o cenário que este teste protege.
 */
function comoSeFosseDe(ownerId: string | null, extras: Record<string, unknown> = {}) {
  useAdminPreferences.setState({
    theme: 'dark',
    name: 'Primeira Pessoa',
    nickname: 'Primeira',
    greeting: true,
    avatarImage: '7',
    avatarShape: 'squircle',
    onboardedAt: 1_700_000_000_000,
    ownerId,
    ...extras,
  })
}

describe('adotarDono', () => {
  beforeEach(() => comoSeFosseDe(null))

  /*
   * Base gravada antes de existir o campo de dono. Quem está entrando naquele
   * momento é o dono legítimo do que já está lá: apagar seria punir a pessoa
   * certa por uma versão antiga do código.
   */
  it('adota a base sem dono em vez de apagá-la', () => {
    useAdminPreferences.getState().adotarDono('abc')

    const estado = useAdminPreferences.getState()
    expect(estado.ownerId).toBe('abc')
    expect(estado.name).toBe('Primeira Pessoa')
    expect(estado.onboardedAt).toBe(1_700_000_000_000)
  })

  it('não mexe em nada quando o dono é o mesmo', () => {
    comoSeFosseDe('abc')
    useAdminPreferences.getState().adotarDono('abc')

    expect(useAdminPreferences.getState().name).toBe('Primeira Pessoa')
  })

  /*
   * O caso que dá o bug: sem isto, a segunda pessoa entra e o painel a
   * cumprimenta pelo nome da primeira, com o avatar da primeira, e o tour de
   * boas-vindas nunca aparece porque a primeira já o concluiu.
   */
  it('zera nome, apelido, avatar e tour quando o dono muda', () => {
    comoSeFosseDe('abc')
    useAdminPreferences.getState().adotarDono('xyz')

    const estado = useAdminPreferences.getState()
    expect(estado.ownerId).toBe('xyz')
    expect(estado.name).toBe('')
    expect(estado.nickname).toBe('')
    expect(estado.avatarImage).toBe('1')
    expect(estado.avatarShape).toBe('circle')
    expect(estado.onboardedAt).toBeNull()
  })

  /*
   * O tema sobrevive à troca, e é a única coisa que sobrevive: aparência é
   * preferência de monitor, não de pessoa. Quem senta num computador de tela
   * escura quer o tema escuro seja qual for a conta.
   */
  it('preserva o tema, que é do dispositivo e não da conta', () => {
    comoSeFosseDe('abc')
    useAdminPreferences.getState().adotarDono('xyz')

    expect(useAdminPreferences.getState().theme).toBe('dark')
  })
})
