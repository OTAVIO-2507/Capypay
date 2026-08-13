import { useEffect, useState, type FormEvent } from 'react'
import { Avatar } from '@/components/Avatar'
import { AVATAR_IMAGE_IDS } from '@/components/avatarImages'
import { Button } from '@/components/ui/Button'
import { Segmented, Toggle, type SegmentOption } from '@/components/ui/Controls'
import { Dialog } from '@/components/ui/Dialog'
import { Field, TextInput } from '@/components/ui/Field'
import { callNameOf, greetingTextFor } from '@/features/dashboard/Greeting'
import type { AvatarShape, Profile } from '@/domain/types'
import { cn } from '@/lib/cn'
import { useFinanceStore } from '@/store/financeStore'
import { useProfile } from '@/store/hooks'

const FORMAS: readonly SegmentOption<AvatarShape>[] = [
  { value: 'circle', label: 'Círculo' },
  { value: 'squircle', label: 'Quadrado' },
]

/**
 * Personalização do perfil.
 *
 * O produto não pede foto nem e-mail — não há conta, não há servidor, e pedir
 * um dado que não se usa seria coleta gratuita. A personalização acontece
 * dentro do que o sistema oferece: nome, apelido, o avatar e se a tela
 * cumprimenta.
 *
 * As vinte ilustrações são **mostradas, não descritas**: miniaturas de verdade,
 * nunca uma lista de nomes ou números para ler e adivinhar.
 */
export function EditProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useProfile()
  const updateProfile = useFinanceStore((state) => state.updateProfile)
  const [rascunho, setRascunho] = useState<Profile>(profile)

  // Reabrir depois de cancelar precisa mostrar o que está salvo, e não o
  // rascunho abandonado da vez anterior.
  useEffect(() => {
    if (open) setRascunho(profile)
  }, [open, profile])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    updateProfile({
      ...rascunho,
      name: rascunho.name.trim(),
      nickname: rascunho.nickname.trim(),
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
        Duas colunas a partir de 640px. Empilhado, este formulário passava de
        oitocentos pixels e o diálogo começava a rolar por dentro, escondendo
        o botão de Salvar — que é exatamente o que a pessoa procura ao
        terminar. Abaixo desse ponto ele volta a empilhar, porque duas colunas
        de 160px não seriam colunas.
      */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Prévia: reproduz o que a barra de topo e o painel vão mostrar. */}
        <div className="flex items-center gap-4 rounded-md bg-sunken p-4">
          <Avatar profile={rascunho} size={60} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {rascunho.name.trim() || 'Sem nome cadastrado'}
            </p>
            <p className="mt-1 truncate text-xs text-muted">
              {saudacao || 'Painel sem saudação'}
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Field label="Nome completo" hint="Vai impresso como titular no cartão do painel.">
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

            Fecha a Regra da Coluna que Fecha sem inventar conteúdo: é o mesmo
            controle que já existia, só que no lugar onde ele tem trabalho a
            fazer.
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
          <legend className="mb-1 text-xs font-medium text-muted">Avatar</legend>

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
            label="Formato do avatar"
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
