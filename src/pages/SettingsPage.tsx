import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Segmented, Toggle, type SegmentOption } from '@/components/ui/Controls'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { createDemoData } from '@/data/demoData'
import { TwoFactorCard } from '@/features/security/TwoFactorCard'
import { DetectSeriesCard } from '@/features/settings/DetectSeriesCard'
import { exportTransactionsCsv } from '@/features/settings/exportCsv'
import { EditProfileDialog } from '@/features/shell/EditProfileDialog'
import type { ThemePreference } from '@/domain/types'
import { useFinanceStore } from '@/store/financeStore'
import {
  useCategories,
  useGoals,
  useProfile,
  useSettings,
  useTransactions,
} from '@/store/hooks'

const THEME_OPTIONS: readonly SegmentOption<ThemePreference>[] = [
  { value: 'light', label: 'Claro', icon: 'sun' },
  { value: 'dark', label: 'Escuro', icon: 'moon' },
  { value: 'system', label: 'Automático', icon: 'monitor' },
]

export function SettingsPage() {
  const profile = useProfile()
  const settings = useSettings()
  const transactions = useTransactions()
  const categories = useCategories()
  const goals = useGoals()

  const setTheme = useFinanceStore((state) => state.setTheme)
  const togglePrivacy = useFinanceStore((state) => state.togglePrivacy)
  const loadDemoData = useFinanceStore((state) => state.loadDemoData)
  const clearAll = useFinanceStore((state) => state.clearAll)

  const navigate = useNavigate()

  const [clearing, setClearing] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [editandoPerfil, setEditandoPerfil] = useState(false)

  return (
    <>
      <PageHeader title="Ajustes" description="Preferências de exibição e gestão dos seus dados." />

      <div className="grid gap-5 lg:grid-cols-2">
        {/*
          O perfil abre o mesmo diálogo do menu de topo, em vez de repetir os
          campos. Duas telas editando o mesmo dado divergem na primeira vez que
          uma opção nova entra só de um lado.
        */}
        <Card>
          <CardHeader title="Perfil" description="Nome, avatar e saudação. Fica neste navegador." />
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <Avatar profile={profile} size={48} />
              <div className="min-w-0">
                <p className="truncate text-[0.8125rem] font-semibold text-ink">
                  {profile.name || 'Sem nome cadastrado'}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Ilustração {profile.avatar.image}
                  {profile.greeting ? ' · com saudação' : ' · sem saudação'}
                </p>
              </div>
            </div>
            <Button
              variant="quiet"
              size="sm"
              icon="square-pen"
              onClick={() => setEditandoPerfil(true)}
              className="shrink-0"
            >
              Personalizar
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Aparência" />
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Tema</p>
              <Segmented
                label="Tema da interface"
                options={THEME_OPTIONS}
                value={settings.theme}
                onChange={setTheme}
              />
            </div>

            <div className="border-t border-hairline pt-4">
              <Toggle
                checked={settings.privacyMode}
                onChange={togglePrivacy}
                label="Modo privacidade"
                description="Mascara todos os valores na tela, para usar em lugar público."
                icon="eye-off"
              />
            </div>
          </div>
        </Card>

        {/* Ocupa a linha inteira: com ele numa das colunas, a grade de cinco
            cartões terminaria com um vão vazio ao lado do último. */}
        <TwoFactorCard />

        <Card>
          <CardHeader
            title="Seus dados"
            description={`${transactions.length} ${transactions.length === 1 ? 'lançamento guardado' : 'lançamentos guardados'} neste navegador.`}
          />
          <div className="flex flex-col gap-3">
            {/* Antes de exportar: é a única entrada de dados que não passa pelo
                formulário, e quem procura "meus dados" está atrás dela. */}
            <div className="flex items-center justify-between gap-4 rounded-md bg-sunken p-3.5">
              <div className="min-w-0">
                <p className="text-[0.8125rem] font-medium text-ink">Importar extrato do banco</p>
                <p className="text-xs text-muted">
                  Arquivo OFX baixado do seu banco, lido aqui no dispositivo. Sem senha, sem
                  intermediário.
                </p>
              </div>
              <Button
                variant="quiet"
                size="sm"
                icon="upload"
                onClick={() => navigate('/importar')}
                className="shrink-0 bg-sheet"
              >
                Importar
              </Button>
            </div>

            {/* Depois de importar: é a ação que conserta o que a importação
                não alcançou, e não faz sentido antes de haver o que reconhecer. */}
            <DetectSeriesCard />

            <div className="flex items-center justify-between gap-4 rounded-md bg-sunken p-3.5">
              <div className="min-w-0">
                <p className="text-[0.8125rem] font-medium text-ink">Exportar para CSV</p>
                <p className="text-xs text-muted">
                  Arquivo pronto para o Excel em português, com acentos corretos.
                </p>
              </div>
              <Button
                variant="quiet"
                size="sm"
                icon="download"
                disabled={transactions.length === 0}
                onClick={() => exportTransactionsCsv(transactions, categories, goals)}
                className="shrink-0 bg-sheet"
              >
                Exportar
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md bg-sunken p-3.5">
              <div className="min-w-0">
                <p className="text-[0.8125rem] font-medium text-ink">Carregar dados de exemplo</p>
                <p className="text-xs text-muted">
                  Três meses fictícios, para ver o painel preenchido. Substitui o que existe hoje.
                </p>
              </div>
              <Button
                variant="quiet"
                size="sm"
                icon="eye"
                onClick={() => setLoadingDemo(true)}
                className="shrink-0 bg-sheet"
              >
                Carregar
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Zona de risco" />
          <div className="flex items-center justify-between gap-4 rounded-md bg-sunken p-3.5">
            <div className="min-w-0">
              <p className="text-[0.8125rem] font-medium text-ink">Apagar tudo</p>
              <p className="text-xs text-muted">
                Remove lançamentos, metas, contas e limites deste navegador. Não há como desfazer.
              </p>
            </div>
            <Button
              variant="quiet"
              size="sm"
              icon="trash-2"
              onClick={() => setClearing(true)}
              className="shrink-0"
            >
              Apagar
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Vale exportar o CSV antes: é a única cópia que sobra fora deste navegador.
          </p>
        </Card>
      </div>

      <ConfirmDialog
        open={clearing}
        onClose={() => setClearing(false)}
        onConfirm={() => {
          clearAll()
          /*
           * Apagar tudo devolve o perfil ao estado de conta nova, e com ele
           * volta o tour de boas-vindas. O tour ilumina elementos reais da
           * moldura, e o segundo passo aponta para o botão de novo lançamento,
           * que só existe no painel: começado aqui em Ajustes, ele abriria
           * procurando um alvo fora da tela. Levar para o painel antes é o que
           * faz a cena ter onde acontecer.
           */
          void navigate('/')
        }}
        title="Apagar todos os dados"
        message={`${transactions.length} ${transactions.length === 1 ? 'lançamento' : 'lançamentos'}, ${goals.length} ${goals.length === 1 ? 'meta' : 'metas'} e todos os limites serão removidos definitivamente deste navegador.`}
        confirmLabel="Apagar tudo"
      />

      <EditProfileDialog open={editandoPerfil} onClose={() => setEditandoPerfil(false)} />

      <ConfirmDialog
        open={loadingDemo}
        onClose={() => setLoadingDemo(false)}
        onConfirm={() => loadDemoData(createDemoData())}
        title="Carregar dados de exemplo"
        message="Os dados atuais serão substituídos por três meses de lançamentos fictícios. Se houver algo que você queira manter, exporte o CSV antes."
        confirmLabel="Carregar exemplo"
      />
    </>
  )
}
