import { describe, expect, it } from 'vitest'
import type { AdminUserSummary, AuditEntry } from './adminApi'
import {
  acessosRecentes,
  acoesPorDia,
  acumuladoPorMes,
  composicaoDeContas,
  criacoesPorMes,
  criadasDesde,
  escalaDe,
  faixasDeAtividade,
  filterAudit,
  filterUsers,
  formatAbsoluteDate,
  formatAbsoluteDateTime,
  formatRelativeTime,
  mediaPorMes,
  nuncaAcessaram,
  summarizeUsers,
  taxaDeAtivacao,
} from './adminMetrics'

const AGORA = new Date('2026-08-10T12:00:00Z').getTime()
const DIA = 24 * 60 * 60 * 1000

function conta(over: Partial<AdminUserSummary> = {}): AdminUserSummary {
  return {
    id: Math.random().toString(36).slice(2),
    email: 'pessoa@exemplo.com',
    role: 'user',
    createdAt: new Date(AGORA - 60 * DIA).toISOString(),
    lastSignInAt: new Date(AGORA - DIA).toISOString(),
    disabled: false,
    ...over,
  }
}

describe('summarizeUsers', () => {
  it('conta papéis, desativadas e quem nunca entrou', () => {
    const resumo = summarizeUsers(
      [
        conta({ role: 'admin' }),
        conta({ role: 'user' }),
        conta({ role: 'user', disabled: true }),
        conta({ role: 'user', lastSignInAt: null }),
      ],
      AGORA,
    )

    expect(resumo.total).toBe(4)
    expect(resumo.admins).toBe(1)
    expect(resumo.regulares).toBe(3)
    expect(resumo.desativadas).toBe(1)
    expect(resumo.nuncaAcessaram).toBe(1)
  })

  it('trata 30 dias como janela fechada, não aberta', () => {
    const dentro = conta({ lastSignInAt: new Date(AGORA - 29 * DIA).toISOString() })
    const fora = conta({ lastSignInAt: new Date(AGORA - 31 * DIA).toISOString() })
    expect(summarizeUsers([dentro, fora], AGORA).ativas30d).toBe(1)
  })

  // Uma conta criada e nunca usada não pode inflar "ativas": era o jeito mais
  // fácil de este painel mentir sobre o próprio uso.
  it('não conta como ativa quem nunca acessou', () => {
    expect(summarizeUsers([conta({ lastSignInAt: null })], AGORA).ativas30d).toBe(0)
  })

  it('devolve zeros para lista vazia, em vez de quebrar', () => {
    const resumo = summarizeUsers([], AGORA)
    expect(resumo).toEqual({
      total: 0,
      admins: 0,
      regulares: 0,
      desativadas: 0,
      ativas30d: 0,
      nuncaAcessaram: 0,
    })
  })
})

describe('nuncaAcessaram', () => {
  it('lista só quem nunca entrou e não está desativado, mais antigas primeiro', () => {
    const nova = conta({ email: 'nova@x.com', lastSignInAt: null, createdAt: new Date(AGORA - DIA).toISOString() })
    const antiga = conta({ email: 'antiga@x.com', lastSignInAt: null, createdAt: new Date(AGORA - 40 * DIA).toISOString() })
    const usou = conta({ email: 'usou@x.com' })
    const desativada = conta({ email: 'off@x.com', lastSignInAt: null, disabled: true })

    const lista = nuncaAcessaram([nova, usou, desativada, antiga])
    expect(lista.map((u) => u.email)).toEqual(['antiga@x.com', 'nova@x.com'])
  })
})

describe('acessosRecentes', () => {
  it('ordena do mais recente e respeita o limite', () => {
    const a = conta({ email: 'a@x.com', lastSignInAt: new Date(AGORA - 3 * DIA).toISOString() })
    const b = conta({ email: 'b@x.com', lastSignInAt: new Date(AGORA - 1 * DIA).toISOString() })
    const c = conta({ email: 'c@x.com', lastSignInAt: new Date(AGORA - 2 * DIA).toISOString() })
    const nunca = conta({ email: 'n@x.com', lastSignInAt: null })

    expect(acessosRecentes([a, b, c, nunca], 2).map((u) => u.email)).toEqual(['b@x.com', 'c@x.com'])
  })
})

describe('filterUsers', () => {
  const lista = [
    conta({ email: 'otavio@gmail.com', role: 'admin' }),
    conta({ email: 'aluno@eniac.edu.br', role: 'user' }),
    conta({ email: 'antigo@eniac.edu.br', role: 'user', disabled: true }),
  ]

  it('busca por trecho do e-mail, ignorando caixa e espaço colado', () => {
    expect(filterUsers(lista, { query: '  ENIAC ', filter: 'todas' })).toHaveLength(2)
  })

  it('recorta por papel, sem trazer desativada junto', () => {
    expect(filterUsers(lista, { query: '', filter: 'usuarios' }).map((u) => u.email)).toEqual([
      'aluno@eniac.edu.br',
    ])
    expect(filterUsers(lista, { query: '', filter: 'admins' })).toHaveLength(1)
  })

  it('recorta por desativadas independente do papel', () => {
    expect(filterUsers(lista, { query: '', filter: 'desativadas' }).map((u) => u.email)).toEqual([
      'antigo@eniac.edu.br',
    ])
  })

  it('combina busca e recorte', () => {
    expect(filterUsers(lista, { query: 'gmail', filter: 'usuarios' })).toHaveLength(0)
    expect(filterUsers(lista, { query: 'gmail', filter: 'admins' })).toHaveLength(1)
  })
})

describe('faixasDeAtividade', () => {
  it('separa as contas nas quatro faixas, sem contar ninguém duas vezes', () => {
    const lista = [
      conta({ lastSignInAt: new Date(AGORA - 2 * DIA).toISOString() }),
      conta({ lastSignInAt: new Date(AGORA - 20 * DIA).toISOString() }),
      conta({ lastSignInAt: new Date(AGORA - 90 * DIA).toISOString() }),
      conta({ lastSignInAt: null }),
      conta({ lastSignInAt: null }),
    ]

    const faixas = faixasDeAtividade(lista, AGORA)
    expect(faixas.map((f) => f.count)).toEqual([1, 1, 1, 2])
    expect(faixas.reduce((soma, f) => soma + f.count, 0)).toBe(lista.length)
  })

  /*
   * Uma faixa some da lista assim que ficar vazia e a leitura de hoje deixa de
   * ser comparável com a de ontem: some também a informação "ninguém sumiu".
   */
  it('mantém as quatro faixas mesmo vazias', () => {
    expect(faixasDeAtividade([], AGORA)).toHaveLength(4)
    expect(faixasDeAtividade([], AGORA).every((f) => f.count === 0)).toBe(true)
  })

  it('põe a fronteira dos 7 dias na faixa certa', () => {
    const dentro = conta({ lastSignInAt: new Date(AGORA - 6 * DIA).toISOString() })
    const fora = conta({ lastSignInAt: new Date(AGORA - 8 * DIA).toISOString() })
    const faixas = faixasDeAtividade([dentro, fora], AGORA)
    expect(faixas[0].count).toBe(1)
    expect(faixas[1].count).toBe(1)
  })
})

describe('criacoesPorMes', () => {
  it('devolve lista vazia sem nenhuma conta', () => {
    expect(criacoesPorMes([], AGORA)).toEqual([])
  })

  /*
   * O buraco importa: uma série que pula os meses sem cadastro encosta dois
   * períodos distantes lado a lado, e o gráfico passa a mentir sobre o ritmo.
   */
  it('inclui os meses vazios entre o primeiro cadastro e hoje', () => {
    const antiga = conta({ createdAt: new Date(AGORA - 90 * DIA).toISOString() })
    const nova = conta({ createdAt: new Date(AGORA).toISOString() })

    const meses = criacoesPorMes([antiga, nova], AGORA)
    expect(meses.length).toBeGreaterThanOrEqual(4)
    expect(meses.some((mes) => mes.count === 0)).toBe(true)
    expect(meses[0].count).toBe(1)
    expect(meses[meses.length - 1].count).toBe(1)
  })

  it('soma contas criadas no mesmo mês', () => {
    const a = conta({ createdAt: new Date(AGORA - 2 * DIA).toISOString() })
    const b = conta({ createdAt: new Date(AGORA - 1 * DIA).toISOString() })
    const meses = criacoesPorMes([a, b], AGORA)
    expect(meses[meses.length - 1].count).toBe(2)
  })

  it('sai em ordem crescente de mês', () => {
    const meses = criacoesPorMes(
      [
        conta({ createdAt: new Date(AGORA - 200 * DIA).toISOString() }),
        conta({ createdAt: new Date(AGORA).toISOString() }),
      ],
      AGORA,
    )
    const ordenado = [...meses].sort((x, y) => x.month.localeCompare(y.month))
    expect(meses.map((m) => m.month)).toEqual(ordenado.map((m) => m.month))
  })
})

describe('escalaDe', () => {
  it('usa um traço por unidade quando a contagem é pequena', () => {
    expect(escalaDe(3)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] })
  })

  /*
   * A folga é a razão de esta função existir. Sem ela a coluna mais alta
   * encosta na borda de cima e a leitura perde a referência de "quanto ainda
   * caberia" — e num pico exatamente divisível o erro passa despercebido.
   */
  it('deixa folga acima da maior coluna, sempre', () => {
    for (const pico of [1, 2, 5, 7, 10, 37, 100]) {
      expect(escalaDe(pico).max).toBeGreaterThan(pico)
    }
  })

  it('mantém os traços em números inteiros', () => {
    for (const pico of [7, 37, 100, 250]) {
      for (const tick of escalaDe(pico).ticks) {
        expect(Number.isInteger(tick)).toBe(true)
      }
    }
  })

  it('devolve traços em ordem crescente começando no zero', () => {
    const { ticks } = escalaDe(37)
    expect(ticks[0]).toBe(0)
    expect([...ticks].sort((a, b) => a - b)).toEqual(ticks)
  })

  // Uma escala com teto zero faria toda altura virar divisão por zero.
  it('sobrevive a pico zero', () => {
    expect(escalaDe(0).max).toBeGreaterThan(0)
  })
})

describe('formatRelativeTime', () => {
  it('cobre a escala de minutos a anos, com plural certo', () => {
    expect(formatRelativeTime(new Date(AGORA - 30_000).toISOString(), AGORA)).toBe('agora')
    expect(formatRelativeTime(new Date(AGORA - 5 * 60_000).toISOString(), AGORA)).toBe('há 5 min')
    expect(formatRelativeTime(new Date(AGORA - 60 * 60_000).toISOString(), AGORA)).toBe('há 1 hora')
    expect(formatRelativeTime(new Date(AGORA - 5 * 60 * 60_000).toISOString(), AGORA)).toBe('há 5 horas')
    expect(formatRelativeTime(new Date(AGORA - DIA).toISOString(), AGORA)).toBe('há 1 dia')
    expect(formatRelativeTime(new Date(AGORA - 5 * DIA).toISOString(), AGORA)).toBe('há 5 dias')
    expect(formatRelativeTime(new Date(AGORA - 45 * DIA).toISOString(), AGORA)).toBe('há 1 mês')
    expect(formatRelativeTime(new Date(AGORA - 400 * DIA).toISOString(), AGORA)).toBe('há 1 ano')
  })

  it('diz "nunca" sem carimbo, e não quebra com lixo', () => {
    expect(formatRelativeTime(null, AGORA)).toBe('nunca')
    expect(formatRelativeTime('não é data', AGORA)).toBe('nunca')
  })

  /*
   * Relógio do servidor à frente do relógio da máquina devolveria "há -3 min".
   * Não é hipótese: é o caso comum de quem tem o horário do sistema errado.
   */
  it('não devolve tempo negativo quando o carimbo está no futuro', () => {
    expect(formatRelativeTime(new Date(AGORA + 5 * 60_000).toISOString(), AGORA)).toBe('agora')
  })
})

describe('formatAbsoluteDate', () => {
  it('devolve "nunca" para ausente ou inválido', () => {
    expect(formatAbsoluteDate(null)).toBe('nunca')
    expect(formatAbsoluteDate('lixo')).toBe('nunca')
  })

  it('formata um instante real', () => {
    expect(formatAbsoluteDate(new Date('2026-08-10T12:00:00Z').toISOString())).toMatch(/2026/)
  })
})

function registro(over: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: Math.floor(Math.random() * 1e9),
    actor_email: 'admin@exemplo.com',
    action: 'create',
    target_email: 'pessoa@exemplo.com',
    detail: null,
    created_at: new Date(AGORA - 60_000).toISOString(),
    ...over,
  }
}

describe('acumuladoPorMes', () => {
  it('soma mês a mês em vez de repetir a contagem do período', () => {
    const acumulado = acumuladoPorMes([
      { month: '2026-06', label: 'jun/26', count: 2 },
      { month: '2026-07', label: 'jul/26', count: 0 },
      { month: '2026-08', label: 'ago/26', count: 3 },
    ])

    expect(acumulado.map((mes) => mes.count)).toEqual([2, 2, 5])
  })

  /*
   * Um mês sem cadastro nenhum mantém o total, e é essa a diferença entre as
   * duas séries: a mensal cai para zero, a acumulada fica parada. Uma curva
   * que descesse estaria contando outra coisa.
   */
  it('nunca desce', () => {
    const acumulado = acumuladoPorMes([
      { month: '2026-06', label: 'jun/26', count: 5 },
      { month: '2026-07', label: 'jul/26', count: 0 },
    ])

    expect(acumulado[1].count).toBe(5)
  })

  it('devolve vazio para série vazia', () => {
    expect(acumuladoPorMes([])).toEqual([])
  })
})

describe('composicaoDeContas', () => {
  /*
   * Somar o total é a condição que autoriza o disco. O recorte anterior
   * subtraía as desativadas do total de usuários, o que tira do grupo errado
   * assim que uma conta de administração está desativada.
   */
  it('as três fatias somam o total, com admin desativado no meio', () => {
    const lista = [
      conta({ role: 'user' }),
      conta({ role: 'user' }),
      conta({ role: 'admin' }),
      conta({ role: 'admin', disabled: true }),
      conta({ role: 'user', disabled: true }),
    ]

    const fatias = composicaoDeContas(lista)

    expect(fatias.map((fatia) => fatia.count)).toEqual([2, 1, 2])
    expect(fatias.reduce((soma, fatia) => soma + fatia.count, 0)).toBe(lista.length)
  })

  it('devolve os três grupos zerados sem nenhuma conta', () => {
    expect(composicaoDeContas([]).map((fatia) => fatia.count)).toEqual([0, 0, 0])
  })
})

describe('taxaDeAtivacao', () => {
  it('conta quem já entrou ao menos uma vez', () => {
    expect(taxaDeAtivacao([conta(), conta(), conta({ lastSignInAt: null })])).toEqual({
      total: 3,
      acessaram: 2,
      percentual: 67,
    })
  })

  // Divisão por zero viraria `NaN` na tela, que é pior que um zero honesto.
  it('devolve zero por cento sem nenhuma conta', () => {
    expect(taxaDeAtivacao([])).toEqual({ total: 0, acessaram: 0, percentual: 0 })
  })
})

describe('criadasDesde', () => {
  it('conta só o que entrou dentro da janela', () => {
    const lista = [
      conta({ createdAt: new Date(AGORA - 5 * DIA).toISOString() }),
      conta({ createdAt: new Date(AGORA - 29 * DIA).toISOString() }),
      conta({ createdAt: new Date(AGORA - 31 * DIA).toISOString() }),
    ]

    expect(criadasDesde(lista, AGORA, 30)).toBe(2)
  })

  it('ignora data ilegível em vez de contá-la', () => {
    expect(criadasDesde([conta({ createdAt: 'não é data' })], AGORA, 30)).toBe(0)
  })
})

describe('mediaPorMes', () => {
  // Com poucos meses, arredondar 1,5 para 2 exagera o ritmo em um terço.
  it('mantém a casa decimal', () => {
    expect(
      mediaPorMes([
        { month: '2026-07', label: 'jul/26', count: 1 },
        { month: '2026-08', label: 'ago/26', count: 2 },
      ]),
    ).toBe(1.5)
  })

  it('devolve zero para série vazia', () => {
    expect(mediaPorMes([])).toBe(0)
  })
})

describe('filterAudit', () => {
  const historico = [
    registro({ action: 'create', target_email: 'nova@exemplo.com' }),
    registro({ action: 'reset_password', target_email: 'antiga@exemplo.com' }),
    registro({ action: 'set_role', target_email: 'promovida@exemplo.com' }),
    registro({
      action: 'delete_user',
      target_email: 'sumiu@exemplo.com',
      created_at: new Date(AGORA - 40 * DIA).toISOString(),
    }),
  ]

  it('agrupa as ações por consequência, não por nome', () => {
    const contas = filterAudit(historico, { query: '', filter: 'contas', period: 'tudo' }, AGORA)
    expect(contas.map((entrada) => entrada.action).sort()).toEqual(['create', 'delete_user'])

    const acesso = filterAudit(historico, { query: '', filter: 'acesso', period: 'tudo' }, AGORA)
    expect(acesso.map((entrada) => entrada.action)).toEqual(['reset_password'])
  })

  /*
   * Quem digita um e-mail quer tudo que aquele endereço tem a ver, sem
   * precisar decidir antes se a pessoa agiu ou sofreu a ação.
   */
  it('busca no autor e no alvo ao mesmo tempo', () => {
    expect(
      filterAudit(historico, { query: 'promovida', filter: 'todas', period: 'tudo' }, AGORA),
    ).toHaveLength(1)
    expect(
      filterAudit(historico, { query: 'admin@exemplo', filter: 'todas', period: 'tudo' }, AGORA),
    ).toHaveLength(4)
  })

  it('recorta por período', () => {
    expect(filterAudit(historico, { query: '', filter: 'todas', period: '30d' }, AGORA)).toHaveLength(
      3,
    )
    expect(
      filterAudit(historico, { query: '', filter: 'todas', period: 'tudo' }, AGORA),
    ).toHaveLength(4)
  })

  /*
   * "Hoje" é o dia do calendário, e não as últimas 24 horas: às nove da manhã,
   * uma janela de 24 horas traz ontem à noite junto, e quem filtrou por hoje
   * não espera isso.
   */
  it('trata hoje como dia do calendário', () => {
    const madrugada = new Date(AGORA)
    madrugada.setHours(0, 30, 0, 0)
    const ontemDeNoite = new Date(madrugada.getTime() - 2 * 60 * 60 * 1000)

    const doDia = filterAudit(
      [
        registro({ created_at: madrugada.toISOString() }),
        registro({ created_at: ontemDeNoite.toISOString() }),
      ],
      { query: '', filter: 'todas', period: 'hoje' },
      AGORA,
    )

    expect(doDia).toHaveLength(1)
  })

  it('combina busca, tipo e período', () => {
    expect(
      filterAudit(historico, { query: 'nova', filter: 'contas', period: '30d' }, AGORA),
    ).toHaveLength(1)
    expect(
      filterAudit(historico, { query: 'nova', filter: 'acesso', period: '30d' }, AGORA),
    ).toHaveLength(0)
  })
})

describe('acoesPorDia', () => {
  /*
   * A grade do calendário só se lê como calendário se os dias vazios estiverem
   * lá: são eles que dão a posição de cada semana e de cada dia da semana.
   */
  it('devolve semanas inteiras, incluindo os dias sem nada', () => {
    const dias = acoesPorDia([registro()], AGORA, 4)

    expect(dias).toHaveLength(28)
    expect(dias.filter((dia) => dia.count > 0)).toHaveLength(1)
  })

  /*
   * A grade fecha no sábado da semana corrente. Sem esse alinhamento a última
   * coluna teria menos dias que as outras, e ler por linha (toda segunda, por
   * exemplo) deixaria de valer.
   */
  it('começa num domingo e termina num sábado', () => {
    const dias = acoesPorDia([], AGORA, 4)

    expect(new Date(`${dias[0].date}T12:00:00`).getDay()).toBe(0)
    expect(new Date(`${dias[dias.length - 1].date}T12:00:00`).getDay()).toBe(6)
  })

  it('soma as ações que caem no mesmo dia', () => {
    const dias = acoesPorDia([registro(), registro(), registro()], AGORA, 4)
    const comAcao = dias.filter((dia) => dia.count > 0)

    expect(comAcao).toHaveLength(1)
    expect(comAcao[0].count).toBe(3)
  })

  it('deixa de fora o que é mais antigo que a janela', () => {
    const antiga = registro({ created_at: new Date(AGORA - 60 * DIA).toISOString() })
    expect(acoesPorDia([antiga], AGORA, 4).every((dia) => dia.count === 0)).toBe(true)
  })

  it('ignora carimbo ilegível em vez de quebrar a grade', () => {
    const dias = acoesPorDia([registro({ created_at: 'não é data' })], AGORA, 4)
    expect(dias).toHaveLength(28)
    expect(dias.every((dia) => dia.count === 0)).toBe(true)
  })
})

describe('formatAbsoluteDateTime', () => {
  // "Há 2 meses" não serve para conferir nada; o histórico precisa da hora.
  it('traz data e hora, não só a data', () => {
    const texto = formatAbsoluteDateTime(new Date(AGORA).toISOString())
    expect(texto).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(texto).toMatch(/\d{2}:\d{2}/)
  })

  it('devolve "nunca" para ausente ou ilegível', () => {
    expect(formatAbsoluteDateTime(null)).toBe('nunca')
    expect(formatAbsoluteDateTime('não é data')).toBe('nunca')
  })
})
