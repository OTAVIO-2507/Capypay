import { create } from 'zustand'
import { createEmptyData } from '@/data/defaults'
import type { AvatarImageId, AvatarShape, Profile, ThemePreference } from '@/domain/types'

const STORAGE_KEY = 'capypay/admin-preferences'

const IMAGENS: readonly AvatarImageId[] = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
]

/**
 * As preferências de quem administra.
 *
 * Moram no `localStorage` deste navegador, e **não** em `FinanceData`, por uma
 * razão de fronteira e não de conveniência: `FinanceData` é o documento
 * financeiro de uma conta, e uma sessão de administração nunca o carrega (ver
 * `RequireUser` em `app/routeGuards.tsx`). Guardar a preferência de tema lá
 * obrigaria o admin a abrir o documento que ele justamente não pode abrir.
 *
 * A consequência aceita: a escolha é por dispositivo, não por conta. Para
 * preferência de aparência isso é o comportamento certo de qualquer forma —
 * quem usa um monitor claro no escritório e um escuro em casa quer exatamente
 * isso.
 */
interface AdminPreferences {
  theme: ThemePreference
  name: string
  nickname: string
  greeting: boolean
  avatarImage: AvatarImageId
  avatarShape: AvatarShape
  /**
   * Quando o tour de boas-vindas foi concluído, ou `null` se ainda não foi.
   *
   * Fica aqui junto com o resto, e por isso vale **por dispositivo**, não por
   * conta: quem administrar de um segundo computador vê o tour de novo. É a
   * mesma consequência que o tema e o avatar já têm, e a alternativa seria
   * guardar isto no servidor só para esta linha.
   */
  onboardedAt: number | null
  /**
   * De quem é este conjunto de preferências.
   *
   * Sem ele, tudo aqui é do **navegador** e não da conta: duas pessoas com
   * acesso de administração no mesmo computador dividiriam nome, apelido,
   * avatar e o marcador de tour. A segunda entraria e o painel a
   * cumprimentaria pelo nome da primeira, e o tour não apareceria para ela.
   *
   * `null` só existe em base gravada antes desta versão, e é adotada sem
   * apagar nada: quem estiver entrando naquele momento é o dono legítimo do
   * que já está lá.
   */
  ownerId: string | null
}

type PerfilPatch = Partial<
  Pick<
    AdminPreferences,
    'name' | 'nickname' | 'greeting' | 'avatarImage' | 'avatarShape' | 'onboardedAt'
  >
>

interface AdminPreferencesState extends AdminPreferences {
  setTheme: (theme: ThemePreference) => void
  setProfile: (patch: PerfilPatch) => void
  /** Declara de quem é a sessão atual, zerando o que for de outra pessoa. */
  adotarDono: (userId: string) => void
}

const PADRAO: AdminPreferences = {
  theme: 'system',
  name: '',
  nickname: '',
  greeting: true,
  avatarImage: '1',
  avatarShape: 'circle',
  onboardedAt: null,
  ownerId: null,
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

function ler(): AdminPreferences {
  try {
    const bruto = window.localStorage.getItem(STORAGE_KEY)
    if (!bruto) return PADRAO

    const salvo = JSON.parse(bruto) as Partial<Record<keyof AdminPreferences, unknown>>
    const tema = salvo.theme
    const imagem = salvo.avatarImage

    return {
      theme: tema === 'light' || tema === 'dark' || tema === 'system' ? tema : PADRAO.theme,
      name: texto(salvo.name),
      nickname: texto(salvo.nickname),
      greeting: salvo.greeting !== false,
      // Um id fora da lista, vindo de uma versão futura com mais ilustrações
      // ou de uma edição à mão no DevTools, não pode virar caminho de imagem
      // arbitrário: cai no primeiro retrato.
      avatarImage: IMAGENS.includes(imagem as AvatarImageId)
        ? (imagem as AvatarImageId)
        : PADRAO.avatarImage,
      avatarShape: salvo.avatarShape === 'squircle' ? 'squircle' : PADRAO.avatarShape,
      onboardedAt: typeof salvo.onboardedAt === 'number' ? salvo.onboardedAt : null,
      ownerId: typeof salvo.ownerId === 'string' ? salvo.ownerId : null,
    }
  } catch {
    // Navegação privativa, armazenamento bloqueado ou JSON estragado: a tela
    // abre no padrão em vez de não abrir.
    return PADRAO
  }
}

export const useAdminPreferences = create<AdminPreferencesState>()((set, get) => {
  const gravar = () => {
    const { theme, name, nickname, greeting, avatarImage, avatarShape, onboardedAt, ownerId } =
      get()
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          theme,
          name,
          nickname,
          greeting,
          avatarImage,
          avatarShape,
          onboardedAt,
          ownerId,
        }),
      )
    } catch {
      // Sem onde gravar, a escolha vale só nesta sessão. Perder a preferência
      // ao fechar a aba é ruim; impedir a troca seria pior.
    }
  }

  return {
    ...ler(),

    setTheme: (theme) => {
      set({ theme })
      gravar()
    },

    setProfile: (patch) => {
      set(patch)
      gravar()
    },

    adotarDono: (userId) => {
      const dono = get().ownerId
      if (dono === userId) return

      /*
       * O tema fica de fora do que se apaga, e de propósito: aparência é
       * preferência de monitor, não de pessoa. Quem senta num computador de
       * tela escura quer o tema escuro seja qual for a conta.
       */
      if (dono === null) set({ ownerId: userId })
      else set({ ...PADRAO, theme: get().theme, ownerId: userId })

      gravar()
    },
  }
})

/**
 * O perfil do admin no formato que o resto do sistema já lê.
 *
 * `Avatar` e `greetingTextFor` recebem um `Profile` inteiro porque no app
 * financeiro é isso que existe. Aqui não há `Profile`: uma sessão de
 * administração nunca abre o documento de dados. Este adaptador monta o
 * mesmo formato a partir das preferências locais, em vez de afrouxar o tipo
 * daqueles componentes para aceitar duas formas diferentes de perfil.
 */
export function useAdminProfile(): Profile {
  const name = useAdminPreferences((state) => state.name)
  const nickname = useAdminPreferences((state) => state.nickname)
  const greeting = useAdminPreferences((state) => state.greeting)
  const image = useAdminPreferences((state) => state.avatarImage)
  const shape = useAdminPreferences((state) => state.avatarShape)

  return {
    ...createEmptyData().profile,
    name,
    nickname,
    greeting,
    avatar: { image, shape },
  }
}
