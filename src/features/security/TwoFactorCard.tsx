import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Controls'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { desativar, listarFatores, type FatorTotp } from './twoFactor'

/**
 * Estado da verificação em duas etapas, e o único jeito de desligá-la.
 *
 * Aqui não se ativa nada. A ativação vive na tela de login, no momento em que
 * a pessoa acabou de provar que a conta é dela, porque proteção que mora
 * atrás de dois cliques é proteção que quase ninguém liga. O que sobra para
 * esta tela é a decisão contrária, que precisa ser pensada e por isso combina
 * com Ajustes.
 */
export function TwoFactorCard() {
  const [fator, setFator] = useState<FatorTotp | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const consultar = useCallback(async () => {
    setCarregando(true)
    try {
      const fatores = await listarFatores()
      setFator(fatores.find((item) => item.verificado) ?? null)
      setErro(null)
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : 'Não foi possível consultar o estado.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void consultar()
  }, [consultar])

  const ativa = fator !== null

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Verificação em duas etapas"
        description="Um código do aplicativo autenticador, além da senha, toda vez que você entra."
      />

      <div className="flex flex-col gap-4 rounded-md bg-sunken p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Icon name={ativa ? 'shield' : 'shield-alert'} size={18} className="mt-0.5 text-faint" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[0.8125rem] font-medium text-ink">
                {carregando ? 'Consultando…' : ativa ? 'Ativa nesta conta' : 'Não configurada'}
              </p>
              {!carregando ? (
                <Badge tone={ativa ? 'strong' : 'outline'}>{ativa ? 'Protegida' : 'Só senha'}</Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {carregando
                ? 'Buscando o estado no servidor.'
                : ativa
                  ? 'Saber sua senha não basta para entrar nesta conta.'
                  : 'Na próxima vez que você entrar, a tela de login vai oferecer o QR code para ativar.'}
            </p>
          </div>
        </div>

        {ativa ? (
          <Button
            variant="quiet"
            size="sm"
            icon="shield-alert"
            onClick={() => setConfirmando(true)}
            className="shrink-0 bg-sheet"
          >
            Desativar
          </Button>
        ) : null}
      </div>

      {erro ? (
        <p className="mt-3 flex items-start gap-2 text-xs font-medium text-ink">
          <Icon name="circle-alert" size={14} className="mt-px" />
          {erro}
        </p>
      ) : null}

      {/*
        Escrito mesmo quando a verificação está desligada: é a informação que
        alguém procura depois de perder o aparelho, e nesse momento a conta
        está trancada em outra tela, não nesta.
      */}
      <p className="mt-3 text-xs text-muted">
        Perdeu o aparelho com o aplicativo? Um administrador remove a verificação da sua conta.
      </p>

      <ConfirmDialog
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={() => {
          void (async () => {
            try {
              if (fator) await desativar(fator.id)
              await consultar()
            } catch (cause) {
              setErro(cause instanceof Error ? cause.message : 'Não foi possível desativar.')
            }
          })()
        }}
        title="Desativar a verificação em duas etapas"
        message="A partir daí, sua senha volta a ser a única coisa entre alguém e esta conta. Você pode ativar de novo na próxima vez que entrar."
        confirmLabel="Desativar"
      />
    </Card>
  )
}
