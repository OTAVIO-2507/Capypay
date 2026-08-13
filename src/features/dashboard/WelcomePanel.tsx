import { useState } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import { Wordmark } from '@/components/Wordmark'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { createDemoData } from '@/data/demoData'
import { TransactionForm } from '@/features/transactions/TransactionForm'
import { useFinanceStore } from '@/store/financeStore'
import { useAccounts, useCategories, useGoals } from '@/store/hooks'

const CAPABILITIES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'arrow-left-right',
    title: 'Lançamentos em segundos',
    body: 'Receita, despesa ou aporte, com categoria, data e parcelamento. Editável depois, um a um.',
  },
  {
    icon: 'chart-column',
    title: 'Limites que avisam durante o mês',
    body: 'Um teto por categoria, com histórico mensal. O painel mostra o que está apertando antes de estourar.',
  },
  {
    icon: 'target',
    title: 'Metas alimentadas por aportes',
    body: 'Dinheiro que sai do saldo sem ter sido gasto. O progresso vem sempre dos aportes, nunca de um número digitado.',
  },
  {
    icon: 'eye-off',
    title: 'Seus dados são só seus',
    body: 'Cada conta enxerga apenas os próprios lançamentos. Nem quem administra a plataforma tem acesso ao que está aqui.',
  },
]

/**
 * Primeira tela de quem nunca usou.
 *
 * Não é um caso de borda decorado: é o primeiro contato de todo avaliador que
 * abre a demonstração pública, e a tela precisa explicar o produto e permitir
 * julgá-lo. Daí os dois caminhos — começar de verdade, ou carregar um mês
 * fictício e ver o painel funcionando.
 */
export function WelcomePanel() {
  const categories = useCategories()
  const goals = useGoals()
  const accounts = useAccounts()
  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const loadDemoData = useFinanceStore((state) => state.loadDemoData)
  const [composing, setComposing] = useState(false)

  return (
    <div className="mx-auto max-w-3xl py-6 sm:py-12">
      {/* Primeira tela de quem chega: aqui o nome precisa aparecer, não só a marca. */}
      <Wordmark className="text-ink" />

      <h1 className="mt-5 text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] text-ink sm:text-[2.125rem]">
        Saiba quanto sobrou, sem abrir uma planilha.
      </h1>
      <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted">
        Um controle financeiro pessoal, direto ao ponto. Você registra o que entra e o que sai,
        define limites por categoria e acompanha suas metas, tudo guardado numa conta que só você
        abre.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-2.5">
        <Button
          icon="plus"
          data-tour="welcome-first-transaction"
          onClick={() => setComposing(true)}
        >
          Registrar meu primeiro lançamento
        </Button>
        <Button variant="quiet" icon="eye" onClick={() => loadDemoData(createDemoData())}>
          Explorar com dados de exemplo
        </Button>
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-xs text-faint">
        <Icon name="circle-alert" size={13} />
        Os dados de exemplo são fictícios e podem ser apagados a qualquer momento em Ajustes.
      </p>

      {/*
        Lista separada por hairline, e não quatro cards iguais. Card é o
        contêiner preguiçoso: usado como estrutura de página, dá a quatro
        assuntos o mesmo peso e transforma a tela num folheto. Aqui os cards
        são reservados aos painéis de dado, que é onde eles significam algo.
      */}
      <dl className="mt-10 grid border-t border-hairline sm:grid-cols-2">
        {CAPABILITIES.map((capability) => (
          <div
            key={capability.title}
            className="flex gap-3 border-b border-hairline py-4 sm:odd:pr-6 sm:even:border-l sm:even:pl-6"
          >
            <Icon name={capability.icon} size={16} className="mt-0.5 text-faint" />
            <div className="min-w-0">
              <dt className="text-[0.8125rem] font-semibold text-ink">{capability.title}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-muted">{capability.body}</dd>
            </div>
          </div>
        ))}
      </dl>

      <Dialog
        open={composing}
        onClose={() => setComposing(false)}
        title="Primeiro lançamento"
        description="Pode ser qualquer coisa. Um café de ontem serve."
      >
        <TransactionForm
          categories={categories}
          goals={goals}
          accounts={accounts}
          onSubmit={(draft, recurrence) => {
            addTransaction(draft, recurrence)
            setComposing(false)
          }}
          onCancel={() => setComposing(false)}
        />
      </Dialog>
    </div>
  )
}
