import { Link } from 'react-router-dom'
import { Icon, type IconName } from '@/components/Icon'
import { Card, CardFooter, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ItemMedia, ItemRow } from '@/components/ui/ItemRow'
import { Figure, Money } from '@/components/ui/Money'
import { findBankBrand } from '@/features/dashboard/bankBrand'
import type { Account } from '@/domain/types'
import type { Cents } from '@/lib/money'

const ROTULO_TIPO: Record<Account['kind'], string> = {
  checking: 'Conta corrente',
  credit_card: 'Cartão de crédito',
  cash: 'Dinheiro',
  investment: 'Investimento',
}

const ICONE_TIPO: Record<Account['kind'], IconName> = {
  checking: 'landmark',
  credit_card: 'credit-card',
  cash: 'banknote',
  investment: 'piggy-bank',
}

/**
 * O saldo somado das contas que guardam dinheiro e informaram saldo.
 *
 * Cartão de crédito fica de fora, e não é esquecimento: o saldo dele é dívida,
 * não reserva. Somá-lo aqui daria um "saldo total" que mistura o que a pessoa
 * tem com o que ela deve.
 *
 * O valor vem de `balanceCents`, que é o que a instituição informou, e não da
 * soma dos lançamentos (ver a nota do campo em `domain/types.ts`). Conta sem
 * saldo informado não entra na soma como zero — ela aparece na lista com um
 * travessão, e a soma é só do que se sabe.
 */
function saldoTotal(accounts: readonly Account[]): Cents | null {
  const conhecidas = accounts.filter((account) => account.balanceCents != null)
  if (conhecidas.length === 0) return null
  return conhecidas.reduce((soma, account) => soma + (account.balanceCents ?? 0), 0)
}

/**
 * "Contas correntes" — o painel que responde "quanto eu tenho, agora".
 *
 * Como na referência: o saldo somado em destaque, cada conta com a marca do
 * banco e o saldo dela, e a contagem no rodapé. O atalho para a tela de Contas
 * é o ícone de carteira no canto, e não um "ver todas" — é uma lista curta,
 * e o que está aqui já é "todas".
 *
 * Toda conta aparece, mesmo sem saldo informado. Ela entra com um travessão e
 * "sem saldo", em vez de sumir: esconder a conta faria o painel parecer vazio
 * para quem cadastrou três contas à mão, e mostrar R$ 0,00 diria que elas
 * estão zeradas — o erro mais perigoso, porque é plausível.
 */
export function AccountsPanel({ accounts }: { accounts: readonly Account[] }) {
  const contas = accounts.filter((account) => !account.archived && account.kind !== 'credit_card')
  const total = saldoTotal(contas)

  return (
    <Card className="flex flex-1 flex-col">
      <CardHeader
        title="Contas correntes"
        action={
          <Link
            to="/contas"
            aria-label="Ver contas"
            title="Ver contas"
            className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink"
          >
            <Icon name="wallet" size={17} />
          </Link>
        }
      />

      {contas.length === 0 ? (
        <EmptyState
          icon="piggy-bank"
          title="Nenhuma conta ainda"
          description="Conecte um banco pelo Open Finance, ou cadastre uma conta em Contas, e o saldo aparece aqui."
        />
      ) : (
        <>
          {total === null ? (
            <Figure value="—" suffix="saldo não informado" />
          ) : (
            <Figure cents={total} suffix="saldo total" />
          )}

          <ul className="mt-5 flex flex-1 flex-col">
            {contas.map((account) => {
              const banco = findBankBrand(account.name, account.institution)

              return (
                <li key={account.id}>
                  <ItemRow
                    media={
                      /*
                        A cor da instituição entra na pastilha: reconhecer o
                        laranja do Inter é mais rápido que ler o nome. Sem banco
                        reconhecido, o ícone do tipo de conta.
                      */
                      <ItemMedia size={48} tint={banco?.cor} ink={banco?.tinta}>
                        {banco ? (
                          <span className="text-sm font-bold">{banco.nome.slice(0, 2).toUpperCase()}</span>
                        ) : (
                          <Icon name={ICONE_TIPO[account.kind]} size={20} />
                        )}
                      </ItemMedia>
                    }
                    title={<span className="text-[0.9375rem]">{banco?.nome ?? account.name}</span>}
                    meta={<span className="text-[0.8125rem]">{ROTULO_TIPO[account.kind]}</span>}
                    value={
                      account.balanceCents == null ? (
                        <span className="text-[0.9375rem] text-muted">—</span>
                      ) : (
                        <Money cents={account.balanceCents} className="text-[0.9375rem] font-semibold" />
                      )
                    }
                    caption={account.balanceCents == null ? 'sem saldo' : undefined}
                  />
                </li>
              )
            })}
          </ul>

          <CardFooter>
            <span>
              {contas.length} {contas.length === 1 ? 'conta' : 'contas'}
            </span>
          </CardFooter>
        </>
      )}
    </Card>
  )
}
