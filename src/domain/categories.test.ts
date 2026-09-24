import { describe, expect, it } from 'vitest'
import {
  CATEGORY_GROUPS,
  categoryColor,
  categoriesInGroup,
  DEFAULT_CATEGORIES,
  groupIdOf,
  groupsFor,
  matchAggregatorCategory,
} from './categories'

describe('catálogo de categorias', () => {
  it('não repete id de subcategoria', () => {
    const ids = DEFAULT_CATEGORIES.map((category) => category.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('toda subcategoria aponta para um grupo que existe, e todo grupo tem subcategoria', () => {
    const grupos = new Set(CATEGORY_GROUPS.map((group) => group.id))
    for (const category of DEFAULT_CATEGORIES) expect(grupos.has(category.group)).toBe(true)
    for (const group of CATEGORY_GROUPS) {
      expect(categoriesInGroup(DEFAULT_CATEGORIES, group.id).length).toBeGreaterThan(0)
    }
  })

  /*
   * As três contagens que a tela de referência mostra em captura. Se alguma
   * mudar, a lista deixou de ser a mesma.
   */
  it.each([
    ['saude', 9],
    ['servicos-digitais', 4],
    ['transporte', 12],
  ])('o grupo %s tem %i subcategorias, como na referência', (grupo, total) => {
    expect(categoriesInGroup(DEFAULT_CATEGORIES, grupo)).toHaveLength(total)
  })

  it('as subcategorias de Serviços digitais são as da referência', () => {
    expect(categoriesInGroup(DEFAULT_CATEGORIES, 'servicos-digitais').map((c) => c.label).sort()).toEqual(
      ['Jogos e videogames', 'Serviços digitais', 'Streaming de música', 'Streaming de vídeo'],
    )
  })

  /*
   * Todo lançamento gravado antes dos grupos aponta para um destes ids. Se um
   * deles sumir do catálogo, esses lançamentos passam a "Sem categoria".
   */
  it.each([
    'alimentacao', 'moradia', 'transporte', 'saude', 'educacao', 'lazer', 'compras',
    'assinaturas', 'salario', 'freelance', 'investimentos', 'meta', 'outros',
  ])('o id antigo %s continua existindo', (id) => {
    expect(DEFAULT_CATEGORIES.some((category) => category.id === id)).toBe(true)
  })

  it('cada grupo tem uma subcategoria com o próprio nome, e ela vem primeiro', () => {
    // Os grupos cujo nome não é o do ramo de origem: "Saúde e bem-estar" junta
    // dois ramos e começa pelo "Saúde"; "Alimentação" começa pelo ramo
    // "Alimentos e bebidas"; "Metas" não existe na origem.
    const excecoes: Record<string, string> = {
      saude: 'Saúde',
      alimentacao: 'Alimentos e bebidas',
      metas: 'Aporte em meta',
    }
    for (const group of CATEGORY_GROUPS) {
      const [primeira] = categoriesInGroup(DEFAULT_CATEGORIES, group.id)
      expect(primeira.label).toBe(excecoes[group.id] ?? group.label)
    }
  })
})

describe('groupIdOf', () => {
  it('acha o grupo da subcategoria', () => {
    expect(groupIdOf('combustivel')).toBe('transporte')
    expect(groupIdOf('academias')).toBe('saude')
    expect(groupIdOf('assinaturas')).toBe('servicos-digitais')
  })

  it('manda id desconhecido para Outros', () => {
    expect(groupIdOf('nao-existe')).toBe('outros')
    expect(groupIdOf(null)).toBe('outros')
  })

  it('prefere o grupo que está na lista da pessoa', () => {
    const lista = [{ ...DEFAULT_CATEGORIES[0], id: 'minha', group: 'lazer' }]
    expect(groupIdOf('minha', lista)).toBe('lazer')
  })
})

describe('groupsFor', () => {
  it('não oferece Renda para despesa nem Alimentação para receita', () => {
    const despesa = groupsFor(DEFAULT_CATEGORIES, 'expense').map((group) => group.id)
    const receita = groupsFor(DEFAULT_CATEGORIES, 'income').map((group) => group.id)
    expect(despesa).not.toContain('renda')
    expect(despesa).toContain('alimentacao')
    expect(receita).toContain('renda')
    expect(receita).not.toContain('alimentacao')
  })
})

describe('categoryColor', () => {
  it('dá à subcategoria a cor do grupo', () => {
    expect(categoryColor('combustivel')).toBe(categoryColor('transporte'))
    expect(categoryColor('streaming-de-video')).toBe('var(--cat-assinaturas)')
  })

  it('aceita o id do grupo direto', () => {
    expect(categoryColor('servicos-digitais')).toBe('var(--cat-assinaturas)')
  })

  it('não inventa cor para grupo fora da paleta', () => {
    expect(categoryColor('viagens')).toBeNull()
    expect(categoryColor('hospedagem')).toBeNull()
    expect(categoryColor(undefined)).toBeNull()
  })
})

describe('matchAggregatorCategory', () => {
  it('ignora caixa, hífen e acento', () => {
    expect(matchAggregatorCategory('THIRD PARTY TRANSFER - PIX', 'expense', DEFAULT_CATEGORIES)).toBe(
      'terceiros-pix',
    )
    expect(matchAggregatorCategory('farmacia', 'expense', DEFAULT_CATEGORIES)).toBe('farmacia')
  })

  it('devolve nulo para vazio e para desconhecido', () => {
    expect(matchAggregatorCategory('', 'expense', DEFAULT_CATEGORIES)).toBeNull()
    expect(matchAggregatorCategory(null, 'expense', DEFAULT_CATEGORIES)).toBeNull()
    expect(matchAggregatorCategory('Nada disso', 'expense', DEFAULT_CATEGORIES)).toBeNull()
  })
})
