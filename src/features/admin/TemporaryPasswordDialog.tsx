import { Button } from '@/components/ui/Button'
import { CardWell } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'

interface TemporaryPasswordDialogProps {
  email: string | null
  password: string | null
  onClose: () => void
}

/**
 * Mostrada uma única vez, logo após redefinir a senha de alguém.
 *
 * O servidor não guarda esta senha em texto puro em lugar nenhum — se esta
 * tela fechar sem ter sido copiada, a única saída é redefinir de novo.
 */
export function TemporaryPasswordDialog({ email, password, onClose }: TemporaryPasswordDialogProps) {
  return (
    <Dialog
      open={password !== null}
      onClose={onClose}
      title="Senha redefinida"
      description={email ? `Repasse esta senha para ${email} por fora do app.` : undefined}
      size="sm"
    >
      <CardWell className="tnum text-center text-lg font-semibold text-ink">{password}</CardWell>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Ela só aparece aqui uma vez. Se fechar sem repassar, será preciso redefinir de novo.
      </p>
      <Button block className="mt-6" onClick={onClose}>
        Copiei, pode fechar
      </Button>
    </Dialog>
  )
}
