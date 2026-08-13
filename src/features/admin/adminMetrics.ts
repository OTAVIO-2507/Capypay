import { toIsoDate } from '@/lib/date'
import type { AdminUserSummary, AuditEntry } from './adminApi'

/**
 * Tudo que este painel sabe é derivado de `listUsers()`: e-mail, papel, data
 * de criação, último acesso e se a conta está desativada. Nada aqui consulta
 * dado financeiro, e nada é estimado — o painel de administração mostra o que
 * existe ou não mostra nada.
 *
 * Funções puras, com o instante recebido por parâmetro em vez de lido de
 * `Date.now()` lá dentro: é o que torna "ativo nos últimos 30 dias" testável
 * sem congelar o relógio do processo.
 */

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

export interface AdminSummary {
  total: number
  admins: number
  regulares: number
  desativadas: number
  ativas30d: number
  nuncaAcessaram: number
}

export function summarizeUsers(users: readonly AdminUserSummary[], now: number): AdminSummary {
  return {
    total: users.length,
    admins: users.filter((user) => user.role === 'admin').length,
    regulares: users.filter((user) => user.role === 'user').length,
    desativadas: users.filter((user) => user.disabled).length,
    ativas30d: users.filter((user) => acessouDesde(user, now - 30 * DIA)).length,
    nuncaAcessaram: users.filter((user) => user.lastSignInAt === null).length,
  }
}

function acessouDesde(user: AdminUserSummary, limite: number): boolean {
  if (!user.lastSignInAt) return false
  const instante = new Date(user.lastSignInAt).getTime()
  return Number.isFinite(instante) && instante >= limite
}

/**
 * Contas criadas mas nunca usadas.
 *
 * É o único item deste painel que pede ação de verdade: alguém recebeu uma
 * senha e nunca entrou, o que quase sempre significa que o repasse se perdeu
 * no caminho. As mais antigas primeiro, porque são as que esperam há mais
 * tempo.
 */
export function nuncaAcessaram(users: readonly AdminUserSummary[]): AdminUserSummary[] {
  return users
    .filter((user) => user.lastSignInAt === null && !user.disabled)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

/** Quem entrou por último, do mais recente para o mais antigo. */
export function acessosRecentes(
  users: readonly AdminUserSummary[],
  limite: number,
): AdminUserSummary[] {
  return users
    .filter((user) => user.lastSignInAt !== null)
    .sort((a, b) => new Date(b.lastSignInAt!).getTime() - new Date(a.lastSignInAt!).getTime())
    .slice(0, limite)
}

export interface FaixaDeAtividade {
  id: string
  label: string
  count: number
}

/**
 * As contas distribuídas por quando entraram pela última vez.
 *
 * As faixas são ordenadas, e a ordem é a informação: da mais recente à que
 * nunca aconteceu. É por isso que o gráfico usa uma cor só — a posição já diz
 * o que uma rampa de tom diria, e gastar o tom nisso seria codificar duas
 * vezes a mesma coisa.
 *
 * Devolve sempre as quatro faixas, inclusive as vazias: uma barra em zero é
 * informação ("ninguém sumiu"), e uma lista que muda de tamanho conforme o
 * dado impede comparar duas leituras feitas em dias diferentes.
 */
export function faixasDeAtividade(
  users: readonly AdminUserSummary[],
  now: number,
): FaixaDeAtividade[] {
  const desde = (dias: number) => now - dias * DIA

  const comAcesso = users.filter((user) => user.lastSignInAt !== null)
  const instante = (user: AdminUserSummary) => new Date(user.lastSignInAt!).getTime()

  return [
    {
      id: '7d',
      label: 'Últimos 7 dias',
      count: comAcesso.filter((user) => instante(user) >= desde(7)).length,
    },
    {
      id: '30d',
      label: 'De 8 a 30 dias',
      count: comAcesso.filter((user) => instante(user) < desde(7) && instante(user) >= desde(30))
        .length,
    },
    {
      id: 'antigo',
      label: 'Mais de 30 dias',
      count: comAcesso.filter((user) => instante(user) < desde(30)).length,
    },
    {
      id: 'nunca',
      label: 'Nunca entraram',
      count: users.filter((user) => user.lastSignInAt === null).length,
    },
  ]
}

export interface CriacoesPorMes {
  /** `AAAA-MM`, para ordenar como texto sem virar `Date`. */
  month: string
  label: string
  count: number
}

const MES_CURTO = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })

/**
 * Contas criadas por mês, do mais antigo ao mais recente.
 *
 * Inclui os meses vazios entre o primeiro cadastro e hoje: uma série temporal
 * que pula os meses sem evento mente sobre o ritmo, porque encosta dois
 * períodos distantes lado a lado como se fossem vizinhos.
 */
export function criacoesPorMes(
  users: readonly AdminUserSummary[],
  now: number,
): CriacoesPorMes[] {
  if (users.length === 0) return []

  const chave = (data: Date) =>
    `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`

  const contagem = new Map<string, number>()
  let primeiro = new Date(now)

  for (const user of users) {
    const criada = new Date(user.createdAt)
    if (Number.isNaN(criada.getTime())) continue
    contagem.set(chave(criada), (contagem.get(chave(criada)) ?? 0) + 1)
    if (criada < primeiro) primeiro = criada
  }

  const meses: CriacoesPorMes[] = []
  const cursor = new Date(primeiro.getFullYear(), primeiro.getMonth(), 1)
  const fim = new Date(now)

  while (cursor <= fim) {
    const id = chave(cursor)
    meses.push({
      month: id,
      label: MES_CURTO.format(cursor).replace('.', ''),
      count: contagem.get(id) ?? 0,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return meses
}

/**
 * Quantas contas existiam ao fim de cada mês.
 *
 * Responde outra pergunta que "criadas por mês", e as duas juntas contam a
 * história inteira: a série mensal dá o ritmo, e a acumulada dá o tamanho. Um
 * mês fraco depois de um forte derruba a primeira e não mexe na segunda, e é
 * exatamente essa diferença que interessa ver lado a lado.
 *
 * Nunca desce, porque exclusão de conta não fica registrada aqui: `listUsers`
 * devolve quem existe hoje, então o acumulado é uma reconstrução a partir das
 * datas de criação sobreviventes, não um histórico de saldo.
 */
export function acumuladoPorMes(meses: readonly CriacoesPorMes[]): CriacoesPorMes[] {
  let soma = 0
  return meses.map((mes) => {
    soma += mes.count
    return { ...mes, count: soma }
  })
}

/**
 * As contas divididas em três grupos que somam o total.
 *
 * Somar o total não é detalhe: é a condição que autoriza um disco. O recorte
 * anterior era `regulares - desativadas`, que só fecha enquanto nenhuma conta
 * de administração estiver desativada. Com uma que esteja, aquela subtração
 * tira do grupo errado e as fatias passam a somar menos que o todo, sem nada
 * na tela denunciando isso.
 */
export function composicaoDeContas(users: readonly AdminUserSummary[]): FaixaDeAtividade[] {
  return [
    {
      id: 'usuarios',
      label: 'Usuários ativos',
      count: users.filter((user) => user.role === 'user' && !user.disabled).length,
    },
    {
      id: 'admins',
      label: 'Administradores',
      count: users.filter((user) => user.role === 'admin' && !user.disabled).length,
    },
    {
      id: 'desativadas',
      label: 'Desativadas',
      count: users.filter((user) => user.disabled).length,
    },
  ]
}

export interface Ativacao {
  total: number
  acessaram: number
  /** Inteiro de 0 a 100. Sem casa decimal: é uma proporção, não uma medida. */
  percentual: number
}

/**
 * Quantas das contas criadas chegaram a ser usadas.
 *
 * É o número que diz se o repasse de senha está funcionando. Uma taxa que cai
 * significa que contas estão sendo criadas e as credenciais não chegam a quem
 * deveria recebê-las.
 */
export function taxaDeAtivacao(users: readonly AdminUserSummary[]): Ativacao {
  const acessaram = users.filter((user) => user.lastSignInAt !== null).length
  return {
    total: users.length,
    acessaram,
    percentual: users.length === 0 ? 0 : Math.round((acessaram / users.length) * 100),
  }
}

/** Contas criadas nos últimos `dias` dias. */
export function criadasDesde(
  users: readonly AdminUserSummary[],
  now: number,
  dias: number,
): number {
  const limite = now - dias * DIA
  return users.filter((user) => {
    const instante = new Date(user.createdAt).getTime()
    return Number.isFinite(instante) && instante >= limite
  }).length
}

/**
 * Média de contas por mês na janela que a série cobre.
 *
 * Uma casa decimal, e não inteiro: com poucos meses, arredondar 1,5 para 2
 * exagera o ritmo em um terço.
 */
export function mediaPorMes(meses: readonly CriacoesPorMes[]): number {
  if (meses.length === 0) return 0
  const total = meses.reduce((soma, mes) => soma + mes.count, 0)
  return Math.round((total / meses.length) * 10) / 10
}

export type AuditFilter = 'todas' | 'contas' | 'acesso' | 'permissoes' | 'ajustes'
export type AuditPeriod = 'tudo' | 'hoje' | '7d' | '30d'

/**
 * Cada ação registrada pertence a um grupo, e o grupo é o que se filtra.
 *
 * Oito ações viram oito botões, que é mais escolha do que se consegue varrer.
 * Os grupos são por consequência, não por nome: criar e excluir andam juntas
 * porque as duas mudam quem existe, e redefinir senha anda com desativar
 * porque as duas mudam quem consegue entrar.
 */
const GRUPO_DA_ACAO: Record<string, AuditFilter> = {
  create: 'contas',
  invite: 'contas',
  delete_user: 'contas',
  disable: 'acesso',
  enable: 'acesso',
  reset_password: 'acesso',
  reset_mfa: 'acesso',
  set_role: 'permissoes',
  set_defaults: 'ajustes',
}

export function grupoDaAcao(action: string): AuditFilter | null {
  return GRUPO_DA_ACAO[action] ?? null
}

/**
 * O início do dia de hoje, no fuso de quem está lendo.
 *
 * "Hoje" precisa ser o dia do calendário, e não as últimas 24 horas: às nove
 * da manhã, uma janela de 24 horas traz ontem à noite junto, e quem filtrou
 * por hoje não espera isso.
 */
function inicioDoDia(now: number): number {
  const data = new Date(now)
  data.setHours(0, 0, 0, 0)
  return data.getTime()
}

/**
 * Busca e recorte do histórico.
 *
 * A busca cobre autor e alvo ao mesmo tempo, de propósito: quem digita um
 * e-mail quer tudo que aquele endereço tem a ver, sem precisar decidir antes
 * se a pessoa agiu ou sofreu a ação.
 */
export function filterAudit(
  entries: readonly AuditEntry[],
  { query, filter, period }: { query: string; filter: AuditFilter; period: AuditPeriod },
  now: number,
): AuditEntry[] {
  const busca = query.trim().toLowerCase()
  const desde =
    period === 'tudo'
      ? null
      : period === 'hoje'
        ? inicioDoDia(now)
        : now - (period === '7d' ? 7 : 30) * DIA

  return entries.filter((entry) => {
    if (filter !== 'todas' && grupoDaAcao(entry.action) !== filter) return false

    if (desde !== null) {
      const instante = new Date(entry.created_at).getTime()
      if (!Number.isFinite(instante) || instante < desde) return false
    }

    if (!busca) return true
    return (
      entry.actor_email.toLowerCase().includes(busca) ||
      (entry.target_email?.toLowerCase().includes(busca) ?? false)
    )
  })
}

export interface DiaDeAtividade {
  /** `AAAA-MM-DD` no fuso de quem lê, que é o dia que a pessoa reconhece. */
  date: string
  count: number
}

/**
 * Quantas ações aconteceram em cada dia das últimas `semanas` semanas.
 *
 * Devolve todos os dias, inclusive os sem nada: a grade do calendário só se
 * lê como calendário se as células vazias estiverem lá. Um período parado é
 * informação, e é uma das poucas que este histórico dá de graça.
 *
 * A grade fecha no sábado da semana corrente, mesmo que ele ainda não tenha
 * chegado. Sem esse alinhamento a última coluna teria menos dias que as
 * outras e a leitura por linha (toda segunda-feira, por exemplo) deixaria de
 * valer.
 */
export function acoesPorDia(
  entries: readonly AuditEntry[],
  now: number,
  semanas: number,
): DiaDeAtividade[] {
  const contagem = new Map<string, number>()

  for (const entry of entries) {
    const instante = new Date(entry.created_at)
    if (Number.isNaN(instante.getTime())) continue
    const chave = toIsoDate(instante)
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
  }

  const fim = new Date(now)
  fim.setHours(0, 0, 0, 0)
  fim.setDate(fim.getDate() + (6 - fim.getDay()))

  const dias: DiaDeAtividade[] = []
  const cursor = new Date(fim)
  cursor.setDate(cursor.getDate() - (semanas * 7 - 1))

  while (cursor <= fim) {
    const chave = toIsoDate(cursor)
    dias.push({ date: chave, count: contagem.get(chave) ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  return dias
}

/**
 * Escala do eixo vertical: um teto redondo e os traços até ele.
 *
 * O topo nunca é o próprio pico. Uma coluna que encosta na borda superior não
 * tem para onde crescer visualmente, e a leitura fica sem folga; arredondar
 * para cima dá esse respiro e ainda garante que os traços caiam em números
 * inteiros, que é o que se consegue ler de relance.
 */
export function escalaDe(pico: number): { max: number; ticks: number[] } {
  if (pico <= 0) return { max: 1, ticks: [0, 1] }

  // Contagens pequenas ficam melhor com um traço por unidade: arredondar 3
  // para 4 só afastaria os números do que a pessoa está contando.
  if (pico <= 5) {
    const max = pico + 1
    return { max, ticks: Array.from({ length: max + 1 }, (_, i) => i) }
  }

  const divisoes = 4
  // O `+ 1` é o que garante a folga: sem ele, um pico exatamente divisível
  // vira o próprio teto e a coluna mais alta encosta na borda de cima.
  const bruto = (pico + 1) / divisoes
  const magnitude = Math.pow(10, Math.floor(Math.log10(bruto)))
  const passo = Math.ceil(bruto / magnitude) * magnitude
  const max = passo * divisoes

  return {
    max,
    ticks: Array.from({ length: divisoes + 1 }, (_, i) => Math.round(passo * i)),
  }
}

export type UserFilter = 'todas' | 'usuarios' | 'admins' | 'desativadas'

/**
 * Busca e recorte da tabela.
 *
 * A busca é por e-mail e ignora caixa e espaço em volta, porque o e-mail é a
 * única coisa que um administrador tem em mãos quando alguém pede ajuda — e
 * quem copia de uma conversa cola com espaço junto.
 */
export function filterUsers(
  users: readonly AdminUserSummary[],
  { query, filter }: { query: string; filter: UserFilter },
): AdminUserSummary[] {
  const busca = query.trim().toLowerCase()

  return users.filter((user) => {
    if (busca && !user.email.toLowerCase().includes(busca)) return false
    if (filter === 'usuarios') return user.role === 'user' && !user.disabled
    if (filter === 'admins') return user.role === 'admin' && !user.disabled
    if (filter === 'desativadas') return user.disabled
    return true
  })
}

/**
 * Tempo decorrido em português, escrito à mão.
 *
 * `Intl.RelativeTimeFormat` daria o mesmo com menos linhas, mas a saída dele
 * varia com a versão do ICU do ambiente — o que transformaria um teste de
 * string exata numa fonte de falha aleatória entre a máquina local e o CI.
 */
export function formatRelativeTime(iso: string | null, now: number): string {
  if (!iso) return 'nunca'

  const instante = new Date(iso).getTime()
  if (!Number.isFinite(instante)) return 'nunca'

  const decorrido = now - instante
  if (decorrido < 0) return 'agora'
  if (decorrido < MINUTO) return 'agora'

  if (decorrido < HORA) {
    const minutos = Math.floor(decorrido / MINUTO)
    return `há ${minutos} min`
  }

  if (decorrido < DIA) {
    const horas = Math.floor(decorrido / HORA)
    return `há ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  }

  const dias = Math.floor(decorrido / DIA)
  if (dias < 30) return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`

  const meses = Math.floor(dias / 30)
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`

  const anos = Math.floor(dias / 365)
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`
}

const DATA_CURTA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

/**
 * Data absoluta de um instante ISO.
 *
 * `lib/date.ts` cuida de data de calendário (`AAAA-MM-DD`), que é outro tipo
 * de coisa: lá a hora não existe de propósito. Estes carimbos vêm do
 * servidor de autenticação com hora e fuso, então formatam aqui.
 */
export function formatAbsoluteDate(iso: string | null): string {
  if (!iso) return 'nunca'
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? 'nunca' : DATA_CURTA.format(data)
}

const DATA_E_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Data com hora, para o histórico.
 *
 * "Há 3 min" responde bem enquanto o evento é recente e para de responder no
 * dia seguinte, quando a pergunta vira "que horas isso foi". Um registro de
 * auditoria que só sabe dizer "há 2 meses" não serve para conferir nada.
 */
export function formatAbsoluteDateTime(iso: string | null): string {
  if (!iso) return 'nunca'
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? 'nunca' : DATA_E_HORA.format(data)
}
