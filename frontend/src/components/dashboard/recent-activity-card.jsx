import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Activity,
  TrendingUp,
  CreditCard,
  Trash2,
  UserPlus,
  Package,
  Settings,
  FileText,
  ShieldCheck,
  Banknote,
} from "lucide-react"

/* ──────────────── Mapeo de acción → visual ──────────────── */

const ACTION_META = {
  REGISTRAR_CIERRE: {
    label: "Cierre de caja",
    Icon: TrendingUp,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  PAGAR_EGRESO: {
    label: "Pago de gasto",
    Icon: CreditCard,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  REGISTRAR_EGRESO: {
    label: "Nuevo gasto",
    Icon: FileText,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  ELIMINAR_EGRESO: {
    label: "Gasto eliminado",
    Icon: Trash2,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
  CREAR_PROVEEDOR: {
    label: "Nuevo proveedor",
    Icon: Package,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
  },
  CREAR_EMPLEADO: {
    label: "Nuevo empleado",
    Icon: UserPlus,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
  ACTUALIZAR_PERMISOS: {
    label: "Permisos actualizados",
    Icon: ShieldCheck,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
  },
  ACTUALIZAR_DISTRIBUCION: {
    label: "Distribución actualizada",
    Icon: Settings,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  LIQUIDAR_SUELDO: {
    label: "Liquidación de sueldo",
    Icon: Banknote,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
}

const DEFAULT_META = {
  label: "Acción",
  Icon: Activity,
  color: "text-muted-foreground",
  bg: "bg-muted",
  border: "border-border",
}

/* ──────────────── Utilidades ──────────────── */

const formatRelativeTime = (dateStr) => {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "Ahora"
  if (diffMin < 60) return `Hace ${diffMin} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays < 7) return `Hace ${diffDays}d`

  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
  })
}

/* ──────────────── Componente de cada entrada ──────────────── */

function ActivityItem({ entry, isLast }) {
  const meta = ACTION_META[entry.action] || DEFAULT_META
  const { Icon, color, bg, border } = meta

  return (
    <div className="flex gap-3 group">
      {/* Timeline vertical */}
      <div className="flex flex-col items-center">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${bg} ${border} border transition-all group-hover:opacity-50`}
        >
          <Icon className={`size-3.5 ${color}`} />
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-border/50 my-1" />
        )}
      </div>

      {/* Contenido */}
      <div className={`flex-1 pb-4 ${isLast ? "" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight truncate">
              {entry.details}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {entry.user?.username}
              </span>
            </div>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap mt-0.5">
            {formatRelativeTime(entry.created_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ──────────────── Card principal ──────────────── */

export function RecentActivityCard({ activities = [], loading }) {
  return (
    <Card className="flex flex-col justify-between h-full">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">
              Actividad Reciente
            </CardTitle>
            <CardDescription className="text-xs">Últimas operaciones del negocio</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-4 overflow-hidden">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground font-mono">
            Cargando actividad...
          </div>
        ) : activities.length === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Activity className="size-8 opacity-30" />
            <p className="text-sm">Sin actividad registrada aún.</p>
            <p className="text-xs max-w-[250px] text-center">
              Cuando se realicen cierres de caja, pagos u otras operaciones,
              aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="max-h-[310px] overflow-y-auto pr-1 custom-scrollbar">
            {activities.map((entry, idx) => (
              <ActivityItem
                key={entry.id}
                entry={entry}
                isLast={idx === activities.length - 1}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
