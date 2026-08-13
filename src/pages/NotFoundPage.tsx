import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon="circle-alert"
        title="Esta página não existe"
        description="O endereço pode ter mudado, ou o link veio de uma versão anterior do aplicativo."
        action={
          <Link to="/">
            <Button variant="quiet" icon="layout-dashboard">
              Voltar ao painel
            </Button>
          </Link>
        }
      />
    </div>
  )
}
