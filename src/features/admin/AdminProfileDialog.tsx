import { useEffect, useState, type FormEvent } from 'react'
import { Avatar } from '@/components/Avatar'
import { AVATAR_IMAGE_IDS } from '@/components/avatarImages'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Segmented, Toggle, type SegmentOption } from '@/components/ui/Controls'
import { Field, TextInput } from '@/components/ui/Field'
import { callNameOf, greetingTextFor } from '@/features/dashboard/Greeting'
import type { AvatarShape, Profile } from '@/domain/types'
import { cn } from '@/lib/cn'
import { useAdminPreferences, useAdminProfile } from '@/store/adminPreferences'
import { useAuthStore } from '@/store/authStore'

const FORMAS: readonly SegmentOption<AvatarShape>[] = [
  { value: 'circle', label: 'Círculo' },
  { value: 'squircle', label: 'Quadrado' },
]

/**
 * Personalização do perfil de quem administra.
 *
 * Mesmo desenho do diálogo do app financeiro (`features/shell/EditProfileDialog`):
 * prévia no topo, nome e apelido, as vinte ilustrações **mostradas** em vez de
 * listadas por número, o formato fechando o grupo porque vale para todas elas,
 * e a saudação como interruptor no fim.
 *
 * O que muda é onde isso é gravado. No app financeiro o perfil vive em
 * `FinanceData.profile`, o documento que viaja com a conta; aqui vive nas
 * preferências locais, porque uma sessão de administração não abre esse
 * documento nem para si mesma.
 *
 * O rascunho existe pelo mesmo motivo do outro diálogo: reabrir depois de
 * cancelar precisa mostrar o que está salvo, e não a escolha abandonada da
 * vez anterior.
 */
export function AdminProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const salvo = useAdminProfile()
  const setProfile = useAdminPreferences((state) => state.setProfile)
  const email = useAuthStore((state) => state.session?.user.email)

  const [rascunho, setRascunho] = useState<Profile>(salvo)

  useEffect(() => {
    if (open) setRascunho(salvo)
    // `salvo` é remontado a cada render pelo adaptador, então entra aqui pelos
    // campos e não pela referência, que mudaria sempre e reabriria o rascunho
    // a cada digitada.
  }, [
    open,
    salvo.name,
    salvo.nickname,
    salvo.greeting,
    salvo.avatar.image,
    salvo.avatar.shape,
  ])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setProfile({
      name: rascunho.name.trim(),
      nickname: rascunho.nickname.trim(),
      greeting: rascunho.greeting,
      avatarImage: rascunho.avatar.image,
      avatarShape: rascunho.avatar.shape,
    })
    onClose()
  }

  const saudacao = greetingTextFor(rascunho, new Date().getHours())

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Personalizar perfil"
      description="Fica guardado só neste navegador."
      size="lg"
    >
      {/*
        Duas colunas a partir de 640px, e não uma pilha. Empilhado, este
        formulário passava de oitocentos pixels e o diálogo começava a rolar
        por dentro, escondendo o botão de Salvar — que é exatamente o que a
        pessoa procura ao terminar. Abaixo desse ponto ele volta a empilhar,
        porque duas colunas de 160px não seriam colunas.
      */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Prévia: reproduz o que a barra de topo e o painel vão mostrar. */}
        <div className="flex items-center gap-4 rounded-md bg-sunken p-4">
          <Avatar profile={rascunho} size={60} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {rascunho.name.trim() || email || 'Sem nome cadastrado'}
            </p>
            <p className="mt-1 truncate text-xs text-muted">
              {saudacao || 'Painel sem saudação'}
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Field label="Seu nome">
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                value={rascunho.name}
                autoFocus
                placeholder="Seu nome"
                onChange={(event) =>
                  setRascunho((atual) => ({ ...atual, name: event.target.value }))
                }
              />
            )}
          </Field>

          <Field
            label="Como quer ser chamado"
            hint={
              rascunho.nickname.trim()
                ? 'Usado só na saudação.'
                : `Opcional. Sem apelido, a saudação usa "${callNameOf({ ...rascunho, nickname: '' }) || 'seu primeiro nome'}".`
            }
          >
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                value={rascunho.nickname}
                placeholder="Apelido"
                onChange={(event) =>
                  setRascunho((atual) => ({ ...atual, nickname: event.target.value }))
                }
              />
            )}
          </Field>

          {/*
            A saudação estava numa faixa própria abaixo das duas colunas, e a
            esquerda terminava muito antes da direita: a grade de vinte
            retratos é bem mais alta que dois campos. `mt-auto` traz este
            bloco para o fim da coluna, e o respiro que sobra passa a separar
            dois grupos em vez de ficar como buraco no pé de um deles.
          */}
          <div className="mt-auto rounded-md bg-sunken p-3.5">
            <Toggle
              checked={rascunho.greeting}
              onChange={(greeting) => setRascunho((atual) => ({ ...atual, greeting }))}
              label="Saudação no painel"
              description="Bom dia, boa tarde ou boa noite, conforme o horário."
              icon="sun"
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-xs font-medium text-muted">Retrato</legend>

          {/*
            Cinco por linha, na ordem de leitura: 1 a 5 na primeira, 6 a 10 na
            segunda, e assim até fechar quatro linhas com os vinte retratos.
          */}
          <div className="grid grid-cols-5 gap-2">
            {AVATAR_IMAGE_IDS.map((id) => {
              const ativo = rascunho.avatar.image === id

              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={ativo}
                  aria-label={`Ilustração ${id}`}
                  title={`Ilustração ${id}`}
                  onClick={() =>
                    setRascunho((atual) => ({ ...atual, avatar: { ...atual.avatar, image: id } }))
                  }
                  className={cn(
                    'flex items-center justify-center rounded-sm py-2',
                    'transition-[background-color,box-shadow,transform] duration-150 active:scale-95',
                    ativo ? 'bg-sunken ring-2 ring-ink ring-inset' : 'hover:bg-sunken',
                  )}
                >
                  <Avatar
                    profile={{ ...rascunho, avatar: { ...rascunho.avatar, image: id } }}
                    size={36}
                  />
                </button>
              )
            })}
          </div>

          {/* O formato vale para as vinte opções acima, então fecha o grupo. */}
          <Segmented
            label="Formato do retrato"
            options={FORMAS}
            value={rascunho.avatar.shape}
            onChange={(shape) =>
              setRascunho((atual) => ({ ...atual, avatar: { ...atual.avatar, shape } }))
            }
            size="sm"
          />
        </fieldset>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} block>
            Cancelar
          </Button>
          <Button type="submit" icon="check" block>
            Salvar
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
