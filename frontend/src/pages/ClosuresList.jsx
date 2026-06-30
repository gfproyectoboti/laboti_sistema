import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import api from "@/api/api"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ClipboardList,
  Loader2,
  PlusCircle,
  Wallet,
  Landmark,
  Banknote,
  Pencil,
} from "lucide-react"

export default function ClosuresList() {

  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [closures, setClosures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Paginación
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchClosures = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get("/closures", { params: { page, limit } })
      setClosures(res.data.data ?? [])
      if (res.data.meta) {
        setTotalPages(res.data.meta.totalPages)
        setTotal(res.data.meta.total)
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error al cargar los cierres de caja")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClosures()
  }, [page])

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatMoney = (value) => {
    return Number(value).toLocaleString("es-CL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // Ícono según nombre de cuenta
  const getAccountIcon = (name) => {
    const lower = name.toLowerCase()
    if (lower.includes("efectivo") || lower.includes("caja")) return Wallet
    if (lower.includes("banco") || lower.includes("bancaria")) return Landmark
    return Banknote
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cierres de Caja</h1>
          <p className="text-sm text-muted-foreground">
            Historial de todos los cierres diarios registrados.
          </p>
        </div>
        <Button
          className="gap-2 w-full sm:w-auto justify-center"
          onClick={() => navigate("/cierres/nuevo")}
        >
          <PlusCircle className="size-4" />
          Nuevo Cierre
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Tabla */}
      {!loading && closures.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted mb-4">
              <ClipboardList className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Sin cierres registrados</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Todavía no se registró ningún cierre de caja. Hacé clic en "Nuevo Cierre" para registrar el primero.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && closures.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
                <ClipboardList className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Registro de Cierres</CardTitle>
                <CardDescription>
                  {total} cierre{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead>Desglose</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {isAdmin && <TableHead className="text-center w-[100px]">Acción</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {closures.map((closure) => (
                  <TableRow key={closure.id}>
                    <TableCell className="font-mono text-muted-foreground">
                      {closure.id}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatDate(closure.date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTime(closure.date)}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${closure.user.role === "ADMIN" || closure.user.role === "MANAGER"
                        ? "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800"
                        : "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800"
                        }`}>
                        {closure.user.username}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {closure.details.map((detail, idx) => {
                          return (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${detail.account.name.toLowerCase().includes('efectivo')
                                  ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800'
                                  : detail.account.name.toLowerCase().includes('transferencia')
                                    ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                                    : 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                }`}
                            >
                              {detail.account.name}: ${formatMoney(detail.amount)}
                            </span>
                          )
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      ${formatMoney(closure.total_amount)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => navigate(`/cierres/editar/${closure.id}`)}
                          title="Editar Cierre de Caja"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Controles de Paginación */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground font-medium">
                  Mostrando <span className="font-semibold text-foreground">{((page - 1) * limit) + 1}</span> a{" "}
                  <span className="font-semibold text-foreground">{Math.min(page * limit, total)}</span> de{" "}
                  <span className="font-semibold text-foreground">{total}</span> cierres
                </div>
                <div className="flex items-center gap-1.5 font-sans">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                    const isCurrent = p === page
                    // Mostrar solo primera, última, actual y adyacentes
                    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
                      return (
                        <Button
                          key={p}
                          variant={isCurrent ? "default" : "outline"}
                          size="sm"
                          className={`size-9 p-0 ${isCurrent ? 'bg-primary text-primary-foreground font-bold' : ''}`}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </Button>
                      )
                    }
                    if (p === 2 || p === totalPages - 1) {
                      return <span key={p} className="text-muted-foreground px-1">...</span>
                    }
                    return null
                  })}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
