/**
 * Verificação em duas etapas com aplicativo autenticador (TOTP).
 *
 * Tudo aqui é a API de MFA do próprio Supabase Auth: o segredo é gerado e
 * guardado por ele, e o código de seis dígitos é conferido no servidor. Nada
 * de segredo passa por este código, e nenhuma verificação acontece no
 * navegador — validar o código no cliente seria teatro, porque quem controla
 * o navegador controla a resposta.
 *
 * As regras que não falam com ninguém moram em `twoFactorRules.ts`, e são
 * reexportadas daqui: a fronteira entre os dois é de teste, não de uso. Quem
 * consome continua importando de um lugar só.
 */
import { supabase } from '@/data/supabaseClient'
import {
  codigoCompleto,
  ehConflitoDeFator,
  FalhaDeSegundoFator,
  mapEnrollError,
  mapTwoFactorError,
  normalizarCodigo,
} from './twoFactorRules'

export {
  codigoCompleto,
  ehConflitoDeFator,
  FalhaDeSegundoFator,
  mapEnrollError,
  mapTwoFactorError,
  normalizarCodigo,
}

export interface FatorTotp {
  id: string
  friendlyName: string
  verificado: boolean
}

export interface Inscricao {
  factorId: string
  /** Data URI de um SVG gerado pelo Supabase, pronto para servir de imagem. */
  qrCode: string
  /** O mesmo segredo do QR, para digitar à mão quando a câmera falha. */
  secret: string
}

/**
 * Todos os fatores TOTP da conta, verificados ou não.
 *
 * Lê `data.all`, e não `data.totp`: o SDK só coloca em `data.totp` o que já
 * foi verificado, então uma inscrição abandonada some dessa lista mesmo
 * continuando a existir no servidor. Foi exatamente isso que impediu a
 * limpeza de pendentes de funcionar, e o cadastro seguinte de acontecer.
 */
export async function listarFatores(): Promise<FatorTotp[]> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw new Error(mapTwoFactorError(error))

  return (data?.all ?? [])
    .filter((fator) => fator.factor_type === 'totp')
    .map((fator) => ({
      id: fator.id,
      friendlyName: fator.friendly_name ?? 'Aplicativo autenticador',
      verificado: fator.status === 'verified',
    }))
}

/** Remove inscrições que ficaram pela metade e bloqueiam a próxima. */
async function limparPendentes(): Promise<void> {
  for (const fator of await listarFatores()) {
    if (!fator.verificado) await supabase.auth.mfa.unenroll({ factorId: fator.id })
  }
}

async function pedirQr(): Promise<Inscricao> {
  /*
   * Sem `friendlyName`. O Supabase recusa um nome repetido na mesma conta, e
   * um nome nosso não acrescenta nada: quem olha a lista vê um aplicativo só.
   */
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })

  if (error || !data) {
    // O objeto inteiro, e não só `message`: código HTTP e `code` do Supabase
    // costumam dizer mais do que a frase.
    console.error('[2FA] falha ao gerar o QR code:', error)
    throw new FalhaDeSegundoFator(
      mapEnrollError(error),
      error?.message ?? 'O servidor não devolveu detalhe nenhum.',
      ehConflitoDeFator(error),
    )
  }

  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

/**
 * Uma inscrição em voo é compartilhada por todos que pedirem.
 *
 * O `StrictMode` do React executa cada efeito duas vezes em desenvolvimento,
 * então dois cadastros disparavam quase juntos: o primeiro criava o fator, o
 * segundo esbarrava nele, e como o erro chegava por último era ele que ficava
 * na tela. Sem uma promessa compartilhada nenhuma limpeza resolve, porque as
 * duas chamadas leem a lista antes de qualquer uma escrever.
 *
 * A promessa é descartada quando termina, e não guardada: "Tentar de novo" e
 * uma entrada futura precisam de um QR novo, não do que já falhou.
 */
let inscricaoEmVoo: Promise<Inscricao> | null = null

/**
 * O último QR gerado, guardado até ser confirmado ou descartado.
 *
 * É o que permite pedir o QR antes de trocar de etapa e o painel já nascer
 * com ele na mão. Sem isto, cada montagem começaria uma inscrição nova e a
 * pessoa veria "Gerando…" mesmo com o código pronto um instante antes.
 */
let inscricaoPronta: Inscricao | null = null

/** O QR já em mãos, se houver. Lido na montagem, antes do primeiro quadro. */
export function inscricaoGuardada(): Inscricao | null {
  return inscricaoPronta
}

/** Esquece o QR guardado: ele deixou de valer, ou outro foi pedido. */
export function descartarInscricao(): void {
  inscricaoPronta = null
}

export function iniciarInscricao(): Promise<Inscricao> {
  if (inscricaoPronta) return Promise.resolve(inscricaoPronta)

  inscricaoEmVoo ??= inscrever()
    .then((pronta) => {
      inscricaoPronta = pronta
      return pronta
    })
    .finally(() => {
      inscricaoEmVoo = null
    })

  return inscricaoEmVoo
}

/**
 * Começa a inscrição e devolve o QR.
 *
 * Uma inscrição que ficou pela metade (a pessoa fechou a tela antes de
 * confirmar) deixa um fator não verificado para trás, e o Supabase recusa uma
 * segunda inscrição enquanto ele existir. Limpar os pendentes antes é o que
 * evita a pessoa ficar presa sem entender por quê.
 *
 * A segunda tentativa após conflito não é insistência cega: ela só acontece
 * quando o servidor disse que já existe um fator, e é precedida da limpeza
 * que dissolve exatamente essa causa. Se o fator existente for verificado, a
 * limpeza não o toca e a recusa se repete, que é o correto.
 */
async function inscrever(): Promise<Inscricao> {
  await limparPendentes()

  try {
    return await pedirQr()
  } catch (falha) {
    if (falha instanceof FalhaDeSegundoFator && falha.conflito) {
      await limparPendentes()
      return await pedirQr()
    }
    throw falha
  }
}

/** Confirma a inscrição com o primeiro código gerado pelo app. */
export async function confirmarInscricao(factorId: string, codigo: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: normalizarCodigo(codigo),
  })
  if (error) throw new Error(mapTwoFactorError(error))
  // Confirmado, o QR virou história: guardá-lo ofereceria de novo um cadastro
  // que já aconteceu.
  descartarInscricao()
}

/**
 * Desliga a verificação desta conta.
 *
 * A ativação mora no login e o desligamento mora em Ajustes, de propósito:
 * ligar é uma decisão do momento em que a pessoa acabou de entrar, e desligar
 * é uma decisão pensada, que ninguém deveria tropeçar no caminho.
 */
export async function desativar(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw new Error(mapTwoFactorError(error))
  descartarInscricao()
}

/**
 * Segunda etapa do login: eleva a sessão de AAL1 para AAL2.
 *
 * A senha sozinha já devolve uma sessão, mas ela vale menos: o Supabase a
 * marca como AAL1, e é o guarda de rota que recusa entrar no aplicativo com
 * ela enquanto existir um fator verificado esperando.
 */
export async function verificarNoLogin(codigo: string): Promise<void> {
  const fatores = await listarFatores()
  const fator = fatores.find((item) => item.verificado)
  if (!fator) throw new Error('Nenhum aplicativo autenticador está cadastrado nesta conta.')

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: fator.id,
    code: normalizarCodigo(codigo),
  })
  if (error) throw new Error(mapTwoFactorError(error))
}

const CHAVE_ADIADO = 'capypay/2fa-adiado'

/**
 * "Agora não" vale por esta sessão do navegador, não para sempre.
 *
 * `sessionStorage` e não `localStorage` é a escolha inteira: recusar uma vez
 * não pode virar recusar para sempre em silêncio, senão a oferta some e a
 * conta fica sem proteção sem ninguém ter decidido isso. Fechar o navegador
 * devolve a pergunta.
 */
export function adiarOferta(): void {
  try {
    window.sessionStorage.setItem(CHAVE_ADIADO, '1')
  } catch {
    // Sem onde gravar, a oferta reaparece na próxima navegação. Insistente,
    // mas nunca impeditivo: a etapa sempre tem como ser recusada.
  }
}

/**
 * Devolve a oferta, para a próxima entrada voltar a perguntar.
 *
 * Chamada a cada login, e não só ao fechar o navegador: a tela promete "dá
 * para pular agora e ativar em outra entrada", e `sessionStorage` sozinho
 * sobrevive a sair e entrar de novo na mesma aba. Sem isto, um "agora não"
 * às nove da manhã silenciava a oferta pelo resto do dia inteiro.
 */
export function devolverOferta(): void {
  try {
    window.sessionStorage.removeItem(CHAVE_ADIADO)
  } catch {
    // Sem onde gravar, `ofertaAdiada` já responde falso: nada a desfazer.
  }
}

export function ofertaAdiada(): boolean {
  try {
    return window.sessionStorage.getItem(CHAVE_ADIADO) === '1'
  } catch {
    return false
  }
}

/** Se a conta já tem um aplicativo autenticador confirmado. */
export async function temSegundoFator(): Promise<boolean> {
  const fatores = await listarFatores()
  return fatores.some((fator) => fator.verificado)
}

/**
 * Se esta sessão ainda precisa da segunda etapa.
 *
 * `nextLevel` é o nível que a conta *exige*; `currentLevel` é o que a sessão
 * já alcançou. Só quando o exigido é aal2 e o alcançado não é que falta
 * digitar o código. Quem não tem fator cadastrado nunca cai aqui.
 */
export async function precisaDeSegundaEtapa(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || !data) return false
  return data.nextLevel === 'aal2' && data.nextLevel !== data.currentLevel
}
