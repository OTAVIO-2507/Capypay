import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  Briefcase,
  Bus,
  Calendar,
  Car,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDashed,
  Clapperboard,
  Coins,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Gift,
  GraduationCap,
  Heart,
  HeartPulse,
  House,
  KeyRound,
  Landmark,
  LaptopMinimal,
  LayoutDashboard,
  ListFilter,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Moon,
  PiggyBank,
  Plane,
  Plus,
  Link2,
  RefreshCw,
  Repeat,
  RotateCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Smartphone,
  SquarePen,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Utensils,
  Wallet,
  Wifi,
  X,
  type LucideProps,
} from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Registro explícito de ícones.
 *
 * Os nomes vêm de dados (categoria, meta), então em algum ponto é preciso ir de
 * string para componente. Um mapa declarado à mão faz esse salto sem arrastar o
 * pacote inteiro de ícones para o bundle, e torna impossível referenciar um
 * ícone que não existe — o TypeScript recusa a chave.
 */
const REGISTRY = {
  'arrow-down-right': ArrowDownRight,
  'arrow-left-right': ArrowLeftRight,
  'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight,
  banknote: Banknote,
  bell: Bell,
  briefcase: Briefcase,
  bus: Bus,
  calendar: Calendar,
  car: Car,
  'chart-column': ChartColumn,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'circle-alert': CircleAlert,
  'circle-dashed': CircleDashed,
  clapperboard: Clapperboard,
  coins: Coins,
  'credit-card': CreditCard,
  download: Download,
  upload: Upload,
  'refresh-cw': RefreshCw,
  link: Link2,
  eye: Eye,
  'eye-off': EyeOff,
  gift: Gift,
  'graduation-cap': GraduationCap,
  heart: Heart,
  'heart-pulse': HeartPulse,
  house: House,
  'key-round': KeyRound,
  landmark: Landmark,
  laptop: LaptopMinimal,
  'layout-dashboard': LayoutDashboard,
  'list-filter': ListFilter,
  lock: Lock,
  'log-out': LogOut,
  mail: Mail,
  monitor: Monitor,
  moon: Moon,
  'piggy-bank': PiggyBank,
  plane: Plane,
  plus: Plus,
  repeat: Repeat,
  'rotate-cw': RotateCw,
  search: Search,
  settings: Settings,
  shield: Shield,
  'shield-alert': ShieldAlert,
  'shopping-bag': ShoppingBag,
  smartphone: Smartphone,
  'square-pen': SquarePen,
  sun: Sun,
  target: Target,
  'trash-2': Trash2,
  'trending-up': TrendingUp,
  'triangle-alert': TriangleAlert,
  user: User,
  'user-check': UserCheck,
  'user-plus': UserPlus,
  'user-x': UserX,
  users: Users,
  utensils: Utensils,
  wallet: Wallet,
  wifi: Wifi,
  x: X,
} as const

export type IconName = keyof typeof REGISTRY

export const ICON_NAMES = Object.keys(REGISTRY) as IconName[]

export function isIconName(value: string): value is IconName {
  return value in REGISTRY
}

interface IconProps extends Omit<LucideProps, 'ref' | 'name'> {
  name: IconName | (string & {})
  size?: number
}

export function Icon({ name, size = 16, className, ...props }: IconProps) {
  const Component = isIconName(name) ? REGISTRY[name] : CircleDashed

  return (
    <Component
      size={size}
      strokeWidth={1.75}
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
      {...props}
    />
  )
}

/** Ícones oferecidos ao usuário na criação de metas. */
export const GOAL_ICON_OPTIONS: { name: IconName; label: string }[] = [
  { name: 'target', label: 'Alvo' },
  { name: 'piggy-bank', label: 'Reserva' },
  { name: 'plane', label: 'Viagem' },
  { name: 'car', label: 'Carro' },
  { name: 'house', label: 'Casa' },
  { name: 'smartphone', label: 'Eletrônico' },
  { name: 'graduation-cap', label: 'Estudo' },
  { name: 'heart', label: 'Saúde' },
  { name: 'gift', label: 'Presente' },
  { name: 'shield-alert', label: 'Emergência' },
]
