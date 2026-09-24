import type {
  Category,
  CategoryGroup,
  CategoryGroupId,
  CategoryId,
  TransactionKind,
} from './types'

/**
 * Catálogo de categorias, em dois níveis: grupo e subcategoria.
 *
 * A versão anterior repetia listas de categoria em cinco lugares do código, e
 * elas divergiram: o formulário oferecia oito opções e o filtro da tabela
 * mostrava seis, então "Transporte" e "Saúde" eram lançáveis mas não filtráveis.
 * Aqui a lista é dado, existe uma vez, e todo seletor deriva dela.
 *
 * **As subcategorias são as do Pluggy**, com os nomes em português que ele
 * mesmo usa, e é por isso que elas batem com as do produto de referência — que
 * também classifica pelo Pluggy. A árvore de origem está publicada em
 * docs.pluggy.ai/docs/transaction-categories. Seguir a mesma árvore tem um
 * efeito prático, além do visual: um lançamento importado do banco já chega
 * com a subcategoria certa, sem regra de palavra-chave adivinhando.
 *
 * **Os grupos são reorganizados**, e não copiados da árvore do Pluggy. Lá,
 * "Saúde" e "Bem-estar e fitness" são ramos diferentes (o segundo dentro de
 * "Serviços"); na tela de referência eles aparecem juntos em "Saúde e
 * bem-estar", com nove subcategorias, e "Educação" e "Ingressos" saem de
 * "Serviços" para grupos próprios. A contagem de cada grupo foi conferida
 * contra a tela de referência onde havia captura: Saúde e bem-estar 9,
 * Serviços digitais 4, Transporte 12.
 *
 * **A subcategoria que tem o nome do grupo é o próprio ramo do Pluggy.** Um
 * lançamento que o agregador só soube dizer que é "Transporte", sem descer
 * até "Estacionamentos", cai na subcategoria "Transporte" do grupo
 * "Transporte". É o mesmo que a referência mostra: "Serviços digitais" dentro
 * de "Serviços digitais".
 *
 * **Os ids da versão de um nível continuam valendo.** As treze categorias
 * antigas viraram subcategorias com o mesmo id — `transporte`, `saude`,
 * `assinaturas` — e por isso nenhum lançamento gravado precisa ser migrado. Os
 * oito grupos que herdaram cor têm o id da categoria que os originou, o que
 * mantém o orçamento gravado e os tokens `--cat-*` no lugar.
 */

type Tipos = readonly TransactionKind[]
const DESPESA: Tipos = ['expense']
const RECEITA: Tipos = ['income']
const AMBOS: Tipos = ['income', 'expense']

interface Folha {
  id: CategoryId
  label: string
  /** Nomes no Pluggy, em inglês, como a documentação publica. */
  pluggy?: readonly string[]
  appliesTo?: Tipos
  icon?: string
}

interface Ramo {
  group: CategoryGroup
  /** Tipo padrão das folhas do grupo; cada folha pode sobrescrever. */
  appliesTo: Tipos
  folhas: readonly Folha[]
}

const CATALOGO: readonly Ramo[] = [
  {
    group: { id: 'alimentacao', label: 'Alimentação', icon: 'utensils' },
    appliesTo: DESPESA,
    folhas: [
      { id: 'alimentacao', label: 'Alimentos e bebidas', pluggy: ['Food and drinks'] },
      { id: 'supermercado', label: 'Supermercado', pluggy: ['Groceries'] },
      { id: 'restaurantes', label: 'Restaurantes, bares e lanchonetes', pluggy: ['Eating out'] },
      { id: 'delivery', label: 'Delivery de alimentos', pluggy: ['Food delivery'] },
    ],
  },
  {
    group: { id: 'moradia', label: 'Moradia', icon: 'house' },
    appliesTo: DESPESA,
    folhas: [
      { id: 'moradia', label: 'Moradia', pluggy: ['Housing'] },
      { id: 'aluguel', label: 'Aluguel', pluggy: ['Rent'] },
      { id: 'utilidades-domesticas', label: 'Utilidades domésticas', pluggy: ['Houseware'] },
      { id: 'iptu', label: 'IPTU', pluggy: ['Urban land and building tax'] },
      { id: 'contas-da-casa', label: 'Serviços de utilidade pública', pluggy: ['Utilities'] },
      { id: 'agua', label: 'Água', pluggy: ['Water'] },
      { id: 'eletricidade', label: 'Eletricidade', pluggy: ['Electricity'] },
      { id: 'gas', label: 'Gás', pluggy: ['Gas'] },
    ],
  },
  {
    group: { id: 'transporte', label: 'Transporte', icon: 'bus' },
    appliesTo: DESPESA,
    folhas: [
      { id: 'transporte', label: 'Transporte', pluggy: ['Transportation'] },
      { id: 'taxi', label: 'Táxi e transporte privado urbano', pluggy: ['Taxi and ride-hailing'], icon: 'car' },
      { id: 'transporte-publico', label: 'Transporte público', pluggy: ['Public transportation'] },
      { id: 'aluguel-de-veiculos', label: 'Aluguel de veículos', pluggy: ['Car rental'], icon: 'car' },
      { id: 'bicicleta', label: 'Bicicleta', pluggy: ['Bicycle'] },
      { id: 'automotivo', label: 'Automotivo', pluggy: ['Automotive'], icon: 'car' },
      { id: 'combustivel', label: 'Postos de gasolina', pluggy: ['Gas stations'], icon: 'car' },
      { id: 'estacionamento', label: 'Estacionamentos', pluggy: ['Parking'], icon: 'car' },
      { id: 'pedagio', label: 'Pedágios e pagamentos no veículo', pluggy: ['Tolls and in-vehicle payment', 'Tolls and in vehicle payment'], icon: 'car' },
      { id: 'impostos-do-veiculo', label: 'Taxas e impostos sobre veículos', pluggy: ['Vehicle ownership taxes and fees'], icon: 'car' },
      { id: 'manutencao-do-veiculo', label: 'Manutenção de veículos', pluggy: ['Vehicle maintenance'], icon: 'car' },
      { id: 'multas', label: 'Multas de trânsito', pluggy: ['Traffic tickets'], icon: 'car' },
    ],
  },
  {
    group: { id: 'saude', label: 'Saúde e bem-estar', icon: 'heart-pulse' },
    appliesTo: DESPESA,
    folhas: [
      { id: 'saude', label: 'Saúde', pluggy: ['Healthcare'] },
      { id: 'dentista', label: 'Dentista', pluggy: ['Dentist'] },
      { id: 'farmacia', label: 'Farmácia', pluggy: ['Pharmacy'] },
      { id: 'otica', label: 'Ótica', pluggy: ['Optometry'] },
      { id: 'hospitais', label: 'Hospitais, clínicas e laboratórios', pluggy: ['Hospital clinics and labs'] },
      { id: 'bem-estar-e-fitness', label: 'Bem-estar e fitness', pluggy: ['Wellness and fitness'] },
      { id: 'academias', label: 'Academias e centros de ginástica', pluggy: ['Gyms and fitness centers'] },
      { id: 'esportes', label: 'Prática de esportes', pluggy: ['Sports practice'] },
      { id: 'bem-estar', label: 'Bem-estar', pluggy: ['Wellness'] },
    ],
  },
  {
    group: { id: 'educacao', label: 'Educação', icon: 'graduation-cap' },
    appliesTo: DESPESA,
    folhas: [
      { id: 'educacao', label: 'Educação', pluggy: ['Education'] },
      { id: 'cursos-online', label: 'Cursos online', pluggy: ['Online courses'] },
      { id: 'universidade', label: 'Universidade', pluggy: ['University'] },
      { id: 'escola', label: 'Escola', pluggy: ['School'] },
      { id: 'creche', label: 'Creche', pluggy: ['Kindergarten'] },
    ],
  },
  {
    group: { id: 'lazer', label: 'Lazer', icon: 'clapperboard' },
    appliesTo: DESPESA,
    folhas: [
      { id: 'lazer', label: 'Lazer', pluggy: ['Leisure'] },
      { id: 'ingressos', label: 'Ingressos', pluggy: ['Tickets'] },
      { id: 'estadios', label: 'Estádios e arenas', pluggy: ['Stadiums and arenas'] },
      { id: 'museus', label: 'Pontos turísticos e museus', pluggy: ['Landmarks and museums'] },
      { id: 'cinema-e-shows', label: 'Cinema, teatro e shows', pluggy: ['Cinema, theater and concerts'] },
    ],
  },
  {
    group: { id: 'viagens', label: 'Viagens', icon: 'plane' },
    appliesTo: DESPESA,
    folhas: [
      { id: 'viagens', label: 'Viagens', pluggy: ['Travel'] },
      { id: 'aereas', label: 'Aeroportos e cias. aéreas', pluggy: ['Airport and airlines'] },
      { id: 'hospedagem', label: 'Hospedagem', pluggy: ['Accommodation', 'Accomodation'] },
      { id: 'milhagem', label: 'Programas de milhagem', pluggy: ['Mileage programs'] },
      { id: 'passagem-de-onibus', label: 'Passagem de ônibus', pluggy: ['Bus tickets'] },
    ],
  },
  {
    group: { id: 'compras', label: 'Compras', icon: 'shopping-bag' },
    appliesTo: DESPESA,
    folhas: [
      { id: 'compras', label: 'Compras', pluggy: ['Shopping'] },
      { id: 'compras-online', label: 'Compras online', pluggy: ['Online shopping'] },
      { id: 'eletronicos', label: 'Eletrônicos', pluggy: ['Electronics'] },
      { id: 'pet', label: 'Pet shops e veterinários', pluggy: ['Pet supplies and vet'] },
      { id: 'vestuario', label: 'Vestuário', pluggy: ['Clothing'] },
      { id: 'infantil', label: 'Artigos infantis', pluggy: ['Kids and toys'] },
      { id: 'livraria', label: 'Livraria', pluggy: ['Bookstore'] },
      { id: 'artigos-esportivos', label: 'Artigos esportivos', pluggy: ['Sports goods'] },
      { id: 'papelaria', label: 'Papelaria', pluggy: ['Office supplies'] },
      // Dinheiro que volta: entra como receita, e só como receita.
      { id: 'cashback', label: 'Cashback', pluggy: ['Cashback'], appliesTo: RECEITA },
    ],
  },
  {
    group: { id: 'servicos-digitais', label: 'Serviços digitais', icon: 'laptop' },
    appliesTo: DESPESA,
    folhas: [
      // Era a categoria "Assinaturas" do nível único. O id fica; o nome passa
      // a ser o do ramo do Pluggy, que é onde Netflix e Spotify caem lá.
      { id: 'assinaturas', label: 'Serviços digitais', pluggy: ['Digital services'] },
      { id: 'jogos', label: 'Jogos e videogames', pluggy: ['Gaming'] },
      { id: 'streaming-de-video', label: 'Streaming de vídeo', pluggy: ['Video streaming'] },
      { id: 'streaming-de-musica', label: 'Streaming de música', pluggy: ['Music streaming'] },
    ],
  },
  {
    group: { id: 'servicos', label: 'Serviços', icon: 'wifi' },
    appliesTo: DESPESA,
    folhas: [
      { id: 'servicos', label: 'Serviços', pluggy: ['Services'] },
      { id: 'telecomunicacoes', label: 'Telecomunicações', pluggy: ['Telecommunications'] },
      { id: 'internet', label: 'Internet', pluggy: ['Internet'] },
      { id: 'celular', label: 'Celular', pluggy: ['Mobile'], icon: 'smartphone' },
      { id: 'tv', label: 'TV', pluggy: ['TV'], icon: 'monitor' },
    ],
  },
  {
    group: { id: 'seguros', label: 'Seguros', icon: 'shield' },
    appliesTo: DESPESA,
    folhas: [
      { id: 'seguros', label: 'Seguros', pluggy: ['Insurance'] },
      { id: 'seguro-de-vida', label: 'Seguro de vida', pluggy: ['Life insurance'] },
      { id: 'seguro-residencial', label: 'Seguro residencial', pluggy: ['Home insurance'] },
      { id: 'plano-de-saude', label: 'Plano de saúde', pluggy: ['Health insurance'] },
      { id: 'seguro-de-veiculo', label: 'Seguro de veículos', pluggy: ['Vehicle insurance'] },
    ],
  },
  {
    group: { id: 'impostos', label: 'Impostos', icon: 'landmark' },
    appliesTo: DESPESA,
    folhas: [
      { id: 'impostos', label: 'Impostos', pluggy: ['Taxes'] },
      { id: 'imposto-de-renda', label: 'Imposto de renda', pluggy: ['Income taxes'] },
      { id: 'imposto-sobre-investimentos', label: 'Imposto sobre investimentos', pluggy: ['Taxes on investments'] },
      { id: 'iof', label: 'Impostos sobre operações financeiras', pluggy: ['Tax on financial operations'] },
    ],
  },
  {
    group: { id: 'taxas-bancarias', label: 'Taxas bancárias', icon: 'banknote' },
    appliesTo: DESPESA,
    folhas: [
      { id: 'taxas-bancarias', label: 'Taxas bancárias', pluggy: ['Bank fees'] },
      { id: 'tarifa-de-conta', label: 'Taxas de conta corrente', pluggy: ['Account fees'] },
      { id: 'tarifa-de-transferencia', label: 'Taxas de transferências e saques', pluggy: ['Wire transfer fees and ATM fees'] },
      { id: 'tarifa-de-cartao', label: 'Taxas de cartão de crédito', pluggy: ['Credit card fees'] },
    ],
  },
  {
    group: { id: 'emprestimos', label: 'Empréstimos e financiamento', icon: 'coins' },
    // Empréstimo entra como receita quando o dinheiro chega, e como despesa
    // em cada parcela paga.
    appliesTo: AMBOS,
    folhas: [
      { id: 'emprestimos-e-financiamento', label: 'Empréstimos e financiamento', pluggy: ['Loans and financing'] },
      { id: 'atraso-e-cheque-especial', label: 'Atraso de pagamentos e custos de cheque especial', pluggy: ['Late payment and overdraft costs'], appliesTo: DESPESA },
      { id: 'juros-cobrados', label: 'Juros cobrados', pluggy: ['Interests charged'], appliesTo: DESPESA },
      { id: 'emprestimo', label: 'Empréstimos', pluggy: ['Loans'] },
      { id: 'financiamento', label: 'Financiamento', pluggy: ['Financing'] },
      { id: 'financiamento-imobiliario', label: 'Financiamento imobiliário', pluggy: ['Real estate financing'] },
      { id: 'financiamento-de-veiculo', label: 'Financiamento de veículos', pluggy: ['Vehicle financing'] },
      { id: 'credito-estudantil', label: 'Empréstimo estudantil', pluggy: ['Student loan'] },
    ],
  },
  {
    group: { id: 'apostas', label: 'Apostas', icon: 'dices' },
    appliesTo: AMBOS,
    folhas: [
      { id: 'apostas', label: 'Apostas', pluggy: ['Gambling'] },
      { id: 'loteria', label: 'Loteria', pluggy: ['Lottery'] },
      { id: 'apostas-online', label: 'Apostas online', pluggy: ['Online bet'] },
    ],
  },
  {
    group: { id: 'doacoes', label: 'Doações', icon: 'heart' },
    appliesTo: DESPESA,
    folhas: [{ id: 'doacoes', label: 'Doações', pluggy: ['Donations'] }],
  },
  {
    group: { id: 'obrigacoes-legais', label: 'Obrigações legais', icon: 'scale' },
    appliesTo: DESPESA,
    folhas: [
      { id: 'obrigacoes-legais', label: 'Obrigações legais', pluggy: ['Legal obligations'] },
      { id: 'saldo-bloqueado', label: 'Saldo bloqueado', pluggy: ['Blocked balances'] },
      { id: 'pensao-alimenticia', label: 'Pensão alimentícia', pluggy: ['Alimony'], appliesTo: AMBOS },
    ],
  },
  {
    group: { id: 'transferencias', label: 'Transferências', icon: 'arrow-left-right' },
    appliesTo: AMBOS,
    folhas: [
      { id: 'transferencias', label: 'Transferências', pluggy: ['Transfers'] },
      { id: 'transferencia-boleto', label: 'Transferência - Boleto bancário', pluggy: ['Transfer - Bank slip', 'Transfer - Bank slip (Boleto)'] },
      { id: 'transferencia-dinheiro', label: 'Transferência - Dinheiro', pluggy: ['Transfer - Cash'] },
      { id: 'transferencia-cheque', label: 'Transferência - Cheque', pluggy: ['Transfer - Check'] },
      { id: 'transferencia-doc', label: 'Transferência - DOC', pluggy: ['Transfer - DOC'] },
      { id: 'transferencia-cambio', label: 'Transferência - Câmbio', pluggy: ['Transfer - Foreign exchange'] },
      { id: 'transferencia-interna', label: 'Transferência - Mesma instituição', pluggy: ['Transfer - Internal'] },
      { id: 'transferencia-pix', label: 'Transferência - PIX', pluggy: ['Transfer - PIX'] },
      { id: 'transferencia-ted', label: 'Transferência - TED', pluggy: ['Transfer - TED'] },
      { id: 'pagamento-de-cartao', label: 'Pagamento de cartão de crédito', pluggy: ['Credit card payment'], icon: 'credit-card' },
      { id: 'transferencia-terceiros', label: 'Transferências para terceiros', pluggy: ['Third-party transfers', 'Third party transfers'] },
      { id: 'terceiros-boleto', label: 'Transferência para terceiros - Boleto bancário', pluggy: ['Third-party transfer - Bank slip', 'Bank slip'] },
      { id: 'terceiros-debito', label: 'Transferência para terceiros - Cartão de débito', pluggy: ['Third-party transfer - Debit card', 'Debit card', 'Debt card'] },
      { id: 'terceiros-doc', label: 'Transferência para terceiros - DOC', pluggy: ['Third-party transfer - DOC', 'DOC'] },
      { id: 'terceiros-pix', label: 'Transferência para terceiros - PIX', pluggy: ['Third-party transfer - PIX', 'PIX'] },
      { id: 'terceiros-ted', label: 'Transferência para terceiros - TED', pluggy: ['Third-party transfer - TED', 'TED'] },
    ],
  },
  {
    group: { id: 'mesma-titularidade', label: 'Transferência mesma titularidade', icon: 'repeat' },
    appliesTo: AMBOS,
    folhas: [
      { id: 'mesma-titularidade', label: 'Transferência mesma titularidade', pluggy: ['Same person transfer'] },
      { id: 'mesma-titularidade-dinheiro', label: 'Transferência mesma titularidade - Dinheiro', pluggy: ['Same person transfer - Cash'] },
      { id: 'mesma-titularidade-pix', label: 'Transferência mesma titularidade - PIX', pluggy: ['Same person transfer - PIX'] },
      { id: 'mesma-titularidade-ted', label: 'Transferência mesma titularidade - TED', pluggy: ['Same person transfer - TED'] },
    ],
  },
  {
    group: { id: 'investimentos', label: 'Investimentos', icon: 'trending-up' },
    appliesTo: AMBOS,
    folhas: [
      { id: 'investimentos', label: 'Investimentos', pluggy: ['Investments'] },
      { id: 'investimento-automatico', label: 'Investimento automático', pluggy: ['Automatic investment'] },
      { id: 'renda-fixa', label: 'Renda fixa', pluggy: ['Fixed income'] },
      { id: 'fundos', label: 'Fundos multimercado', pluggy: ['Mutual funds'] },
      { id: 'renda-variavel', label: 'Renda variável', pluggy: ['Variable income'] },
      { id: 'ajuste-de-margem', label: 'Ajuste de margem', pluggy: ['Margin'] },
      { id: 'dividendos', label: 'Juros de rendimentos e dividendos', pluggy: ['Proceeds interests and dividends'], appliesTo: RECEITA },
      { id: 'previdencia', label: 'Previdência', pluggy: ['Pension'] },
    ],
  },
  {
    group: { id: 'renda', label: 'Renda', icon: 'briefcase' },
    appliesTo: RECEITA,
    folhas: [
      { id: 'renda', label: 'Renda', pluggy: ['Income'] },
      { id: 'salario', label: 'Salário', pluggy: ['Salary'] },
      { id: 'aposentadoria', label: 'Aposentadoria', pluggy: ['Retirement'] },
      // Era "Freelance". O id fica; o nome passa a ser o do Pluggy, que é onde
      // renda de trabalho por conta própria cai lá.
      { id: 'freelance', label: 'Atividades empresariais', pluggy: ['Entrepreneurial activities'] },
      { id: 'auxilio-do-governo', label: 'Auxílio do governo', pluggy: ['Government aid'] },
      { id: 'renda-nao-recorrente', label: 'Renda não-recorrente', pluggy: ['Non-recurring income'] },
    ],
  },
  {
    // Só deste produto: o aporte em meta é um tipo de lançamento próprio, e
    // não existe no agregador.
    group: { id: 'metas', label: 'Metas', icon: 'target' },
    appliesTo: ['contribution'],
    folhas: [{ id: 'meta', label: 'Aporte em meta' }],
  },
  {
    group: { id: 'outros', label: 'Outros', icon: 'circle-dashed' },
    appliesTo: AMBOS,
    folhas: [{ id: 'outros', label: 'Outros' }],
  },
]

export const CATEGORY_GROUPS: readonly CategoryGroup[] = CATALOGO.map((ramo) => ramo.group)

export const DEFAULT_CATEGORIES: Category[] = CATALOGO.flatMap((ramo) =>
  ramo.folhas.map((folha) => ({
    id: folha.id,
    label: folha.label,
    icon: folha.icon ?? ramo.group.icon,
    appliesTo: [...(folha.appliesTo ?? ramo.appliesTo)],
    builtin: true,
    group: ramo.group.id,
    ...(folha.pluggy ? { aggregatorNames: folha.pluggy } : {}),
  })),
)

/** Categoria usada quando um lançamento importado não tem correspondência. */
export const FALLBACK_CATEGORY_ID: CategoryId = 'outros'
export const FALLBACK_GROUP_ID: CategoryGroupId = 'outros'
export const CONTRIBUTION_CATEGORY_ID: CategoryId = 'meta'

const GRUPO_POR_ID = new Map(CATEGORY_GROUPS.map((group) => [group.id, group]))
const GRUPO_DA_NATIVA = new Map(DEFAULT_CATEGORIES.map((category) => [category.id, category.group]))

export function categoriesFor(
  categories: readonly Category[],
  kind: TransactionKind,
): Category[] {
  return categories.filter((category) => category.appliesTo.includes(kind))
}

export function findCategory(
  categories: readonly Category[],
  id: CategoryId | undefined | null,
): Category | undefined {
  if (!id) return undefined
  return categories.find((category) => category.id === id)
}

export function categoryLabel(
  categories: readonly Category[],
  id: CategoryId | undefined | null,
): string {
  return findCategory(categories, id)?.label ?? 'Sem categoria'
}

export function categoryIcon(
  categories: readonly Category[],
  id: CategoryId | undefined | null,
): string {
  return findCategory(categories, id)?.icon ?? 'circle-dashed'
}

/** O grupo pelo id, caindo em "Outros" quando o id não existe. */
export function findGroup(id: CategoryGroupId | undefined | null): CategoryGroup {
  return (id ? GRUPO_POR_ID.get(id) : undefined) ?? GRUPO_POR_ID.get(FALLBACK_GROUP_ID)!
}

/**
 * O grupo de uma subcategoria.
 *
 * Olha primeiro a lista da pessoa, que é a fonte de verdade, e depois o
 * catálogo nativo — o que deixa funções sem acesso à lista, como a de cor,
 * responderem também. Id desconhecido cai em "Outros": um lançamento com
 * categoria que deixou de existir continua somando em algum lugar.
 */
export function groupIdOf(
  id: CategoryId | undefined | null,
  categories?: readonly Category[],
): CategoryGroupId {
  if (!id) return FALLBACK_GROUP_ID
  const daLista = categories?.find((category) => category.id === id)?.group
  const grupo = daLista ?? GRUPO_DA_NATIVA.get(id)
  return grupo && GRUPO_POR_ID.has(grupo) ? grupo : FALLBACK_GROUP_ID
}

/**
 * Os grupos que têm ao menos uma subcategoria para o tipo, na ordem do
 * catálogo. "Renda" não aparece no orçamento de despesas, e "Alimentação" não
 * aparece para uma receita.
 */
export function groupsFor(
  categories: readonly Category[],
  kind: TransactionKind,
): CategoryGroup[] {
  const comFolha = new Set(categoriesFor(categories, kind).map((category) => category.group))
  return CATEGORY_GROUPS.filter((group) => comFolha.has(group.id))
}

/** As subcategorias de um grupo, na ordem do catálogo. */
export function categoriesInGroup(
  categories: readonly Category[],
  groupId: CategoryGroupId,
): Category[] {
  return categories.filter((category) => category.group === groupId)
}

/**
 * Os oito grupos que têm matiz próprio, na ordem em que a paleta foi validada.
 * Só eles: a lista é fechada de propósito.
 *
 * O matiz é do **grupo**, e toda subcategoria veste o do seu. Noventa
 * subcategorias com cor própria seriam noventa matizes que nenhum validador
 * separa; oito grupos são o que a paleta foi feita para distinguir. "Serviços
 * digitais" herdou o token de "Assinaturas", a categoria de onde ele veio.
 */
const COR_DO_GRUPO = new Map<CategoryGroupId, string>([
  ['alimentacao', 'var(--cat-alimentacao)'],
  ['moradia', 'var(--cat-moradia)'],
  ['transporte', 'var(--cat-transporte)'],
  ['saude', 'var(--cat-saude)'],
  ['educacao', 'var(--cat-educacao)'],
  ['lazer', 'var(--cat-lazer)'],
  ['compras', 'var(--cat-compras)'],
  ['servicos-digitais', 'var(--cat-assinaturas)'],
])

/**
 * O matiz de uma subcategoria ou de um grupo, ou `null` para quem não tem.
 *
 * Aceita os dois ids porque as telas que somam falam de grupo e as que listam
 * falam de subcategoria, e as duas precisam da mesma cor para "o laranja" ser
 * a mesma coisa no gráfico e na tabela. Um id de grupo que coincide com o de
 * uma subcategoria — `transporte` é os dois — dá a mesma resposta pelos dois
 * caminhos, porque a subcategoria mora no grupo de mesmo nome.
 *
 * Devolver `null` é a parte importante. Grupo fora da lista **não ganha cor
 * gerada**: um matiz inventado em tempo de execução não passa por validador
 * nenhum e pode nascer a ΔE 2 do vizinho, ilegível para quem tem daltonismo e
 * indistinguível para quem não tem. Quem não está na lista veste Tinta, o
 * neutro do sistema, e continua se identificando pelo ícone e pelo rótulo.
 */
export function categoryColor(id: CategoryId | CategoryGroupId | undefined | null): string | null {
  if (!id) return null
  const grupo = GRUPO_POR_ID.has(id) ? id : GRUPO_DA_NATIVA.get(id)
  return (grupo && COR_DO_GRUPO.get(grupo)) ?? null
}

/** Sem acento, sem caixa e sem pontuação: "Third-party" casa com "third party". */
function chave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * A subcategoria para o nome que o agregador deu ao lançamento, ou `null`.
 *
 * Casa pelo nome em inglês publicado na documentação e também pelo rótulo em
 * português, porque o agregador pode mandar qualquer um dos dois conforme a
 * conexão. Respeita `appliesTo`, como a sugestão por palavra-chave: um
 * estorno classificado como "Farmácia" não vira receita de farmácia, cai na
 * regra seguinte.
 */
export function matchAggregatorCategory(
  nome: string | null | undefined,
  kind: TransactionKind,
  categories: readonly Category[],
): CategoryId | null {
  if (!nome) return null
  const alvo = chave(nome)
  if (!alvo) return null

  for (const category of categoriesFor(categories, kind)) {
    const nomes = [category.label, ...(category.aggregatorNames ?? [])]
    if (nomes.some((item) => chave(item) === alvo)) return category.id
  }
  return null
}

/**
 * Mapeia os rótulos livres da versão anterior para os identificadores atuais.
 * Fora dessa tabela, o texto vira slug e, se ainda assim não bater, cai em
 * "Outros" — nenhum lançamento antigo pode se perder na migração.
 */
export const LEGACY_CATEGORY_MAP: Record<string, CategoryId> = {
  alimentacao: 'alimentacao',
  moradia: 'moradia',
  transporte: 'transporte',
  saude: 'saude',
  educacao: 'educacao',
  lazer: 'lazer',
  compras: 'compras',
  trabalho: 'salario',
  investimentos: 'investimentos',
  meta: 'meta',
  outros: 'outros',
}
