/**
 * As regras da verificação em duas etapas que não falam com ninguém.
 *
 * Separadas de `twoFactor.ts` porque aquele módulo cria o cliente Supabase ao
 * ser importado, e um teste de lógica pura não deveria precisar de um backend
 * configurado para rodar: era exatamente o que quebrava a esteira, onde as
 * variáveis de ambiente só chegam ao passo de build.
 *
 * Mesmo motivo de `store/authErrors.ts` viver fora de `store/authStore.ts`.
 */

/** Traduz as falhas do Auth para frases que dizem o que fazer. */
export function mapTwoFactorError(error: { message?: string } | null | undefined): string {
  const mensagem = (error?.message ?? '').toLowerCase()

  if (mensagem.includes('invalid totp code') || mensagem.includes('invalid code')) {
    return 'Código incorreto. Confira o app e tente o código atual.'
  }
  if (mensagem.includes('expired')) {
    return 'O código expirou. Use o que está no app agora.'
  }
  if (mensagem.includes('rate limit') || mensagem.includes('too many')) {
    return 'Tentativas demais. Espere um pouco antes de tentar de novo.'
  }
  if (mensagem.includes('mfa') && mensagem.includes('disabled')) {
    return 'A verificação em duas etapas não está habilitada neste projeto Supabase.'
  }
  return 'Não foi possível verificar o código. Tente de novo.'
}

/**
 * O código que o app gera tem seis dígitos e nada mais.
 *
 * Limpar espaço e traço aqui, e não só no visual, é o que faz o valor colado
 * de um gerenciador de senhas passar: muitos copiam como "123 456".
 */
export function normalizarCodigo(bruto: string): string {
  return bruto.replace(/\D/g, '').slice(0, 6)
}

export function codigoCompleto(codigo: string): boolean {
  return normalizarCodigo(codigo).length === 6
}

/**
 * Falha que carrega, além da frase em português, o texto cru do servidor.
 *
 * Traduzir o erro e jogar o original fora deixa a pessoa (e quem for
 * consertar) sem nada para investigar quando a frase amigável não cobre o
 * caso real. O detalhe fica guardado aqui e a tela decide se mostra.
 */
export class FalhaDeSegundoFator extends Error {
  readonly detalhe: string
  /** Se o servidor recusou por já existir um fator, e não por outro motivo. */
  readonly conflito: boolean

  constructor(mensagem: string, detalhe: string, conflito = false) {
    super(mensagem)
    this.name = 'FalhaDeSegundoFator'
    this.detalhe = detalhe
    this.conflito = conflito
  }
}

/**
 * Erros que aparecem ao gerar o QR, que são outros dos que aparecem ao
 * conferir um código digitado.
 */
export function mapEnrollError(error: { message?: string } | null | undefined): string {
  const mensagem = (error?.message ?? '').toLowerCase()

  if (mensagem.includes('mfa') && mensagem.includes('disabled')) {
    return 'A verificação em duas etapas não está habilitada neste projeto Supabase.'
  }
  if (mensagem.includes('friendly name')) {
    return 'Esta conta já tem um aplicativo autenticador cadastrado.'
  }
  if (mensagem.includes('maximum') || mensagem.includes('over_enrolled')) {
    return 'Esta conta já atingiu o limite de aplicativos cadastrados.'
  }
  if (mensagem.includes('aal2') || mensagem.includes('assurance')) {
    return 'Esta conta já tem verificação ativa. Entre com o código antes de cadastrar outro aplicativo.'
  }
  if (mensagem.includes('rate limit') || mensagem.includes('too many')) {
    return 'Tentativas demais. Espere um pouco antes de tentar de novo.'
  }
  return 'Não foi possível gerar o QR code.'
}

/**
 * Se a recusa foi por já existir um fator, e não por outro motivo.
 *
 * É esta resposta que decide se vale limpar e tentar de novo. Reconhecer
 * errado tem dois custos opostos: um falso positivo faz o app insistir num
 * erro que a limpeza não resolve, e um falso negativo devolve à pessoa um
 * bloqueio que se desfazia sozinho.
 */
export function ehConflitoDeFator(error: { message?: string } | null | undefined): boolean {
  const mensagem = (error?.message ?? '').toLowerCase()
  return mensagem.includes('already exists') || mensagem.includes('friendly name')
}
