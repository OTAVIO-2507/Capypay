import { describe, expect, it } from 'vitest'
import { isValidIsoDate, todayIso } from '@/lib/date'
import { migrateLegacyData, reconcileData } from './migrate'

/**
 * A migração roda automaticamente na primeira abertura e transforma dados
 * reais, digitados ao longo de meses. Um erro aqui não dá tela de erro: dá
 * número errado, silenciosamente. Por isso o teste cobre cada conversão.
 */
const LEGACY = JSON.stringify({
  user: { name: 'Otávio' },
  settings: {
    theme: 'dark',
    privacyMode: true,
    budgetsByMonth: {
      '2024-03': { 'Alimentação': 800, Moradia: 1500, Lazer: 0 },
    },
  },
  goals: [
    { id: 'g1', name: 'Reserva', icon: 'shield-alert', target: 20000, current: 5000 },
    { id: 'g2', name: 'Viagem', icon: 'plane', target: 8000, current: 0 },
  ],
  transactions: [
    { id: 't1', description: 'Salário', amount: 6200, type: 'income', category: 'Trabalho', date: '2024-03-05' },
    { id: 't2', description: 'Mercado', amount: 19.99, type: 'expense', category: 'Alimentação', date: '2024-03-08' },
    { id: 't3', description: 'Aporte', amount: 700, type: 'goal', goalId: 'g1', category: 'Meta', date: '2024-03-15' },
    { id: 't4', description: 'Órfão', amount: 300, type: 'goal', goalId: 'inexistente', category: 'Meta', date: '2024-03-20' },
    { id: 't5', description: 'Categoria desconhecida', amount: 50, type: 'expense', category: 'Petshop', date: '2024-03-22' },
    { id: 't6', description: 'Valor zerado', amount: 0, type: 'expense', category: 'Lazer', date: '2024-03-25' },
  ],
})

describe('migrateLegacyData', () => {
  const result = migrateLegacyData(LEGACY)

  it('converte a base sem perder nenhum lançamento com valor', () => {
    // Seis lançamentos na origem, um deles com valor zero — que é descarte
    // legítimo, porque não afeta nenhum total.
    expect(result?.transactions).toHaveLength(5)
  })

  it('converte reais em centavos, arredondando o ponto flutuante', () => {
    const mercado = result?.transactions.find((t) => t.description === 'Mercado')
    expect(mercado?.amountCents).toBe(1999)
  })

  it('traduz o tipo "goal" antigo para aporte', () => {
    const aporte = result?.transactions.find((t) => t.id === 't3')
    expect(aporte?.kind).toBe('contribution')
    expect(aporte?.goalId).toBe('g1')
  })

  it('converte aporte órfão em despesa, porque o dinheiro saiu do saldo de qualquer forma', () => {
    const orfao = result?.transactions.find((t) => t.id === 't4')
    expect(orfao?.kind).toBe('expense')
    expect(orfao?.goalId).toBeNull()
  })

  it('mapeia o texto livre de categoria para o catálogo atual', () => {
    expect(result?.transactions.find((t) => t.id === 't1')?.categoryId).toBe('salario')
    expect(result?.transactions.find((t) => t.id === 't2')?.categoryId).toBe('alimentacao')
  })

  it('joga categoria desconhecida em "Outros" em vez de descartar o lançamento', () => {
    const desconhecida = result?.transactions.find((t) => t.id === 't5')
    expect(desconhecida?.categoryId).toBe('outros')
    expect(desconhecida?.amountCents).toBe(5000)
  })

  it('converte metas e descarta o progresso persistido, que agora é derivado', () => {
    const reserva = result?.goals.find((g) => g.id === 'g1')
    expect(reserva?.targetCents).toBe(2000000)
    expect(reserva).not.toHaveProperty('current')
  })

  it('converte os limites de orçamento e ignora os zerados', () => {
    const marco = result?.budgets['2024-03']
    expect(marco?.alimentacao).toBe(80000)
    expect(marco?.moradia).toBe(150000)
    expect(marco?.lazer).toBeUndefined()
  })

  it('preserva perfil e preferências', () => {
    expect(result?.profile.name).toBe('Otávio')
    expect(result?.settings.theme).toBe('dark')
    expect(result?.settings.privacyMode).toBe(true)
  })

  it('marca todo lançamento migrado como manual, para a sincronização futura não sobrescrevê-lo', () => {
    expect(result?.transactions.every((t) => t.source === 'manual')).toBe(true)
  })

  it('devolve null para JSON inválido em vez de derrubar a abertura', () => {
    expect(migrateLegacyData('{ não é json }')).toBeNull()
  })

  it('devolve null para uma base antiga vazia, para não disparar o aviso de migração à toa', () => {
    expect(migrateLegacyData(JSON.stringify({ transactions: [], goals: [] }))).toBeNull()
  })
})

/**
 * Reparo na leitura.
 *
 * Este grupo existe por causa de um incidente: um lançamento com data
 * corrompida já gravado fazia a formatação lançar durante a renderização e
 * derrubava a aplicação inteira, sem caminho de volta. Sanear na abertura cura
 * a base em vez de deixar o usuário preso com um dado que ele não consegue nem
 * alcançar para corrigir.
 */
describe('reconcileData', () => {
  const corrompida = {
    schemaVersion: 2,
    profile: { name: 'Otávio' },
    settings: { theme: 'dark', privacyMode: false },
    accounts: [],
    categories: [],
    goals: [],
    budgets: {},
    transactions: [
      { id: 'a', kind: 'expense', description: 'Sem data', amountCents: 1000, date: '', categoryId: 'lazer' },
      { id: 'b', kind: 'expense', description: 'Data lixo', amountCents: 2000, date: 'NaN-NaN-NaN', categoryId: 'lazer' },
      { id: 'c', kind: 'expense', description: 'Dia impossível', amountCents: 3000, date: '2024-02-31', categoryId: 'lazer' },
      { id: 'd', kind: 'expense', description: 'Válido', amountCents: 4000, date: '2024-03-15', categoryId: 'lazer' },
      { id: 'e', kind: 'expense', description: 'Sem valor', amountCents: 0, date: '2024-03-15', categoryId: 'lazer' },
      { id: 'f', kind: 'sei-la', description: 'Tipo inválido', amountCents: 5000, date: '2024-03-15', categoryId: 'lazer' },
      null,
    ],
  }

  const result = reconcileData(corrompida)

  it('não descarta lançamento por causa da data: perder a data é ruim, perder o lançamento é pior', () => {
    expect(result.transactions.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd', 'f'])
  })

  it('substitui toda data inválida por uma data real', () => {
    expect(result.transactions.every((t) => isValidIsoDate(t.date))).toBe(true)
    for (const id of ['a', 'b', 'c']) {
      expect(result.transactions.find((t) => t.id === id)?.date).toBe(todayIso())
    }
  })

  it('preserva a data de quem já estava correto', () => {
    expect(result.transactions.find((t) => t.id === 'd')?.date).toBe('2024-03-15')
  })

  it('descarta lançamento sem valor e entrada que nem é objeto', () => {
    expect(result.transactions.find((t) => t.id === 'e')).toBeUndefined()
    expect(result.transactions).not.toContain(null)
  })

  it('normaliza tipo desconhecido para despesa', () => {
    expect(result.transactions.find((t) => t.id === 'f')?.kind).toBe('expense')
  })

  it('sobrevive a uma base que não é objeto', () => {
    expect(reconcileData(null).transactions).toEqual([])
    expect(reconcileData('lixo').transactions).toEqual([])
    expect(reconcileData({ transactions: 'não é lista' }).transactions).toEqual([])
  })

  /*
   * `avatar.image`, ao contrário dos outros campos do perfil, vira caminho
   * de imagem direto — um id fora da lista de dez não pode atravessar sem
   * checagem, mesmo vindo de uma base que a própria aplicação gravou numa
   * versão futura com mais ilustrações, ou editada à mão no DevTools. Sem
   * campo `null` — todo perfil sempre tem uma ilustração — o resgate cai na
   * primeira, e não em vazio.
   */
  it('aceita um id de ilustração válido', () => {
    const perfil = { name: 'Otávio', avatar: { image: '7' } }
    expect(reconcileData({ profile: perfil }).profile.avatar.image).toBe('7')
  })

  /*
   * O id fora da lista vem de uma versão futura com mais retratos, ou de uma
   * edição à mão no armazenamento. Sem esta rede, o `Record` de imagens
   * devolve `undefined` e o avatar quebra.
   *
   * O caso usava `'11'` e passou a falhar quando a lista foi de dez para
   * vinte, o que é o teste funcionando: um número que existe não serve para
   * provar o tratamento de um número que não existe.
   */
  it('cai na primeira ilustração quando o id está fora da lista', () => {
    const perfil = { name: 'Otávio', avatar: { image: '404' } }
    expect(reconcileData({ profile: perfil }).profile.avatar.image).toBe('1')
  })

  it('cai na primeira ilustração quando a imagem não é string, ou falta — base de antes da funcionalidade existir', () => {
    expect(reconcileData({ profile: { name: 'Otávio', avatar: { image: 7 } } }).profile.avatar.image).toBe('1')
    expect(reconcileData({ profile: { name: 'Otávio' } }).profile.avatar.image).toBe('1')
  })

  /*
   * `onboardedAt` decide se o tour de boas-vindas abre. Errar para o lado
   * errado joga uma apresentação na cara de quem já usa o produto há meses —
   * e é exatamente o que aconteceria lendo o campo ausente como `null`, já
   * que nenhuma base gravada antes do tour tem esse campo.
   */
  describe('onboardedAt', () => {
    it('preserva a marca quando ela existe', () => {
      expect(reconcileData({ profile: { name: 'Otávio', onboardedAt: 1234 } }).profile.onboardedAt).toBe(1234)
    })

    it('trata base antiga com nome como já apresentada', () => {
      expect(reconcileData({ profile: { name: 'Otávio' } }).profile.onboardedAt).toBe(0)
    })

    it('abre o tour só para perfil realmente vazio', () => {
      expect(reconcileData({ profile: { name: '   ' } }).profile.onboardedAt).toBeNull()
      expect(reconcileData({ profile: {} }).profile.onboardedAt).toBeNull()
      expect(reconcileData({}).profile.onboardedAt).toBeNull()
    })
  })
})
