import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '@/components/Icon'
import { Dialog } from '@/components/ui/Dialog'
import { monthInsight } from '@/domain/selectors'
import { callNameOf, useGreeting } from '@/features/dashboard/Greeting'
import { useCategories, useProfile, useSelectedMonth, useTransactions } from '@/store/hooks'

/**
 * Os atalhos que o painel oferece.
 *
 * São perguntas que a pessoa faria ao assistente, respondidas pela tela que já
 * responde a elas. Quando a conversa de verdade existir, cada um deles vira
 * uma pergunta enviada — e o rótulo foi escrito como pergunta desde já para
 * essa troca não mudar o que a pessoa lê.
 */
const ATALHOS: readonly { label: string; to: string; icon: IconName }[] = [
  { label: 'Para onde foi meu dinheiro?', to: '/categorias', icon: 'tags' },
  { label: 'O que eu gastei este mês?', to: '/transacoes', icon: 'arrow-left-right' },
  { label: 'Quanto ainda cabe no cartão?', to: '/contas', icon: 'credit-card' },
  { label: 'Quais assinaturas eu pago?', to: '/assinaturas', icon: 'repeat' },
]

/**
 * O botão flutuante que abre o assistente, e o painel que ele abre.
 *
 * Fica fixo no rodapé, centralizado, em todas as abas — é o único elemento do
 * produto que acompanha a pessoa por todas as telas, e o anel iridescente em
 * volta dele (ver `.anel-assistente`, em `styles.css`) existe para ele ser
 * reconhecível de longe sem precisar ler.
 *
 * **O que o painel não tem, e por quê.** Não há campo de conversa. A conversa
 * livre depende do modelo de linguagem, que ainda não está ligado, e um campo
 * que aceita a pergunta e não responde é pior que campo nenhum: ele promete
 * uma coisa que a tela não entrega, e a pessoa só descobre depois de digitar.
 * O painel mostra o que já é verdade — a leitura do mês, calculada, e atalhos
 * para as telas que respondem às perguntas mais comuns — e diz em uma linha o
 * que ainda falta.
 */
export function AssistantLauncher() {
  const [aberto, setAberto] = useState(false)

  const transactions = useTransactions()
  const categories = useCategories()
  const month = useSelectedMonth()
  const profile = useProfile()
  const saudacao = useGreeting()

  const insight = useMemo(
    () => monthInsight(transactions, categories, month, callNameOf(profile)),
    [transactions, categories, month, profile],
  )

  return (
    <>
      {/*
        O anel é o invólucro, e o botão é a pílula escura dentro dele: um
        pixel de padding revela o degradê como contorno. Borda com degradê não
        existe em CSS sem máscara, e máscara recortaria também o foco.
      */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 flex justify-center lg:bottom-6">
        <div className="anel-assistente pointer-events-auto rounded-full p-px shadow-[var(--shadow-float)]">
          <button
            type="button"
            onClick={() => setAberto(true)}
            aria-haspopup="dialog"
            className="inline-flex h-12 items-center gap-2.5 rounded-full bg-sheet px-6 text-[0.875rem] font-medium text-ink transition-colors duration-150 hover:bg-sunken"
          >
            <Icon name="sparkles" size={17} aria-hidden="true" className="text-accent" />
            Conversar com a Capy
          </button>
        </div>
      </div>

      <Dialog
        open={aberto}
        onClose={() => setAberto(false)}
        title="Capy"
        description="Sua assistente financeira"
      >
        <p className="text-lg leading-snug font-semibold tracking-[-0.01em] text-accent">
          {saudacao}, como posso ajudar?
        </p>
        <p className="mt-3 text-[0.875rem] leading-relaxed text-ink">{insight.message}</p>

        <ul className="mt-6 flex flex-col gap-2">
          {ATALHOS.map((atalho) => (
            <li key={atalho.to}>
              <Link
                to={atalho.to}
                onClick={() => setAberto(false)}
                className="flex h-12 items-center gap-3 rounded-full border border-hairline bg-sheet px-4 text-[0.8125rem] font-medium text-ink transition-colors duration-150 hover:border-hairline-strong hover:bg-sunken"
              >
                <Icon name={atalho.icon} size={16} aria-hidden="true" className="text-faint" />
                <span className="flex-1">{atalho.label}</span>
                <Icon name="arrow-up-right" size={14} aria-hidden="true" className="text-faint" />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-xs leading-relaxed text-muted">
          A conversa livre — perguntar qualquer coisa sobre seu dinheiro e receber a resposta
          aqui — chega quando a assistente for ligada. Por enquanto, os atalhos levam às telas que
          já respondem.
        </p>
      </Dialog>
    </>
  )
}
