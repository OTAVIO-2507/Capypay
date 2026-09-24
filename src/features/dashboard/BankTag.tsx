import type { Account } from '@/domain/types'
import { cn } from '@/lib/cn'
import { findBankBrand } from './bankBrand'

/**
 * A conta de um lançamento ou de uma série: a pastilha com a cor do banco e
 * o nome ao lado.
 *
 * Aparece na coluna "Conta" de Transações e na linha de cada assinatura, e é
 * o mesmo desenho nos dois lugares para "o laranja" querer dizer Inter em
 * toda parte.
 *
 * As iniciais dentro da pastilha garantem que a informação sobreviva sem a
 * cor, e a tinta vem da luminância do banco, não de um preto fixo: o roxo do
 * Nubank com preto por cima não passa de 3:1.
 */
export function BankTag({
  account,
  size = 'md',
  className,
}: {
  account: Account
  /** `md` na tabela, `sm` dentro de uma linha de metadados. */
  size?: 'sm' | 'md'
  className?: string
}) {
  const banco = findBankBrand(account.name, account.institution)
  const nome = banco?.nome ?? account.name

  return (
    <span className={cn('flex min-w-0 items-center', size === 'sm' ? 'gap-1.5' : 'gap-2', className)}>
      <span
        aria-hidden
        style={banco ? { backgroundColor: banco.cor, color: banco.tinta } : undefined}
        className={cn(
          'inline-flex shrink-0 items-center justify-center font-bold',
          size === 'sm' ? 'size-[18px] rounded-[5px] text-[0.5rem]' : 'size-6 rounded-[6px] text-[0.5625rem]',
          !banco && 'bg-sunken text-muted',
        )}
      >
        {nome.slice(0, 2).toUpperCase()}
      </span>
      <span title={account.name} className="truncate">
        {nome}
      </span>
    </span>
  )
}
