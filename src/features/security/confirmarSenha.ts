import { createClient } from '@supabase/supabase-js'

/**
 * Confirma que quem está na frente da tela sabe a senha atual da conta.
 *
 * Existe por causa de uma assimetria: `updateUser({ password })` troca a senha
 * com a sessão que já está aberta, sem perguntar mais nada. Numa sessão
 * sequestrada — ou num computador deixado desbloqueado por dois minutos —, isso
 * é a diferença entre um acesso indevido que acaba quando a sessão expira e um
 * que vira dono da conta para sempre, com a pessoa legítima do lado de fora.
 *
 * O Supabase tem uma opção equivalente no painel ("Secure password change"),
 * mas ela reautentica por código enviado no e-mail — e esta instalação não tem
 * SMTP configurado, então ligá-la só impediria a troca de acontecer.
 *
 * ## Por que um cliente separado
 *
 * A verificação é `signInWithPassword`, que é a única prova de senha que
 * existe: quem confere é o servidor. Feita no cliente principal, ela **trocaria
 * a sessão em curso** pela recém-criada — e numa conta com verificação em duas
 * etapas a sessão nova nasce em `aal1`, ou seja, a pessoa seria devolvida à
 * tela de código no meio de uma troca de senha, sem entender por quê.
 *
 * Este cliente não persiste nada e não renova nada: ele existe pelo tempo da
 * pergunta e some. A sessão que ele cria fica só na memória dele.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export async function senhaAtualConfere(email: string, senha: string): Promise<boolean> {
  const efemero = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { error } = await efemero.auth.signInWithPassword({ email, password: senha })

  // Descarta a sessão criada pela verificação. `local` e não `global`: a saída
  // global encerraria também a sessão de verdade da pessoa, no meio da ação.
  await efemero.auth.signOut({ scope: 'local' }).catch(() => {
    // Nada a fazer: o cliente é descartado logo abaixo de qualquer forma.
  })

  return !error
}
