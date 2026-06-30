import { useState, useEffect } from "react"
import api from "@/api/api"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SearchBar } from "@/components/ui/search-bar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Loader2,
  PlusCircle,
  Store,
  MoreHorizontal,
  Pencil,
  Trash2,
  ShieldAlert,
} from "lucide-react"

const DEFAULT_FORM = { id: null, name: "", payment_condition: "Contado", credit_days: 0, visible_to_employee: true }

export default function ProvidersModule() {
  const { user } = useAuth()
  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER"
  const canManage = isAdmin || user?.permissions?.canManageProviders === true

  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")

  // Paginación
  const [page, setPage] = useState(1)
  const [limit] = useState(8) // Mostrar 8 proveedores por página
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({ ...DEFAULT_FORM })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [isDeleteLoading, setIsDeleteLoading] = useState(false)

  const filtered = providers.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  async function fetchProviders() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get("/providers", {
        params: { page, limit }
      })
      const data = res.data
      if (Array.isArray(data)) {
        setProviders(data)
        setTotalPages(1)
        setTotal(data.length)
      } else if (data.success) {
        setProviders(data.data)
        if (data.meta) {
          setTotalPages(data.meta.totalPages)
          setTotal(data.meta.total)
        } else {
          setTotalPages(1)
          setTotal(data.data.length)
        }
      } else {
        setError(data.message || "Error al obtener proveedores")
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error al cargar los proveedores")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProviders()
  }, [page])

  useEffect(() => {
    setPage(1)
  }, [searchTerm])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const isEditing = !!formData.id
    const url = isEditing ? `/providers/${formData.id}` : "/providers"
    const conditionClean =
      formData.payment_condition === "Crédito" || formData.payment_condition === "Credito"
        ? "Credito"
        : "Contado"

    const payload = {
      name: formData.name,
      payment_condition: conditionClean,
      credit_days: 0,
      visible_to_employee: formData.visible_to_employee,
    }

    try {
      if (isEditing) {
        await api.put(url, payload)
      } else {
        await api.post(url, payload)
      }
      await fetchProviders()
      closeModal()
    } catch (err) {
      const errData = err.response?.data
      if (errData?.errors) {
        setError(errData.errors.map((e) => e.message).join(", "))
      } else {
        setError(errData?.message || "Error al guardar el proveedor")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleteLoading(true)
    try {
      await api.delete(`/providers/${deletingId}`)
      await fetchProviders()
      setDeletingId(null)
    } catch (err) {
      setError(err.response?.data?.message || "Error al eliminar el proveedor")
      setDeletingId(null)
    } finally {
      setIsDeleteLoading(false)
    }
  }

  const openModal = (provider = null) => {
    if (provider) {
      setFormData({
        id: provider.id,
        name: provider.name,
        payment_condition: provider.payment_condition ?? "Contado",
        credit_days: provider.credit_days ?? 0,
        visible_to_employee: provider.visible_to_employee ?? true,
      })
    } else {
      setFormData({ ...DEFAULT_FORM })
    }
    setError(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setFormData({ ...DEFAULT_FORM })
    setIsModalOpen(false)
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proveedores</h1>
          <p className="text-sm text-muted-foreground">Catálogo de proveedores vinculados a los egresos.</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted mb-4">
              <ShieldAlert className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Acceso restringido</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              No poseés el permiso <span className="font-mono text-xs">canManageProviders</span> para gestionar los proveedores.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proveedores</h1>
          <p className="text-sm text-muted-foreground">
            Administrá el catálogo de proveedores vinculados a los egresos.
          </p>
        </div>
        <Button className="gap-2 w-full sm:w-auto justify-center" onClick={() => openModal()}>
          <PlusCircle className="size-4" />
          Nuevo Proveedor
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && providers.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted mb-4">
              <Store className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Sin proveedores registrados</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Todavía no cargaste ningún proveedor. Hacé clic en "Nuevo Proveedor" para agregar el primero.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && providers.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
                  <Store className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Listado de Proveedores</CardTitle>
                  <CardDescription>
                    {providers.length} proveedor{providers.length !== 1 ? "es" : ""} registrado{providers.length !== 1 ? "s" : ""}
                  </CardDescription>
                </div>
              </div>

              <SearchBar
                placeholder="Buscar por nombre..."
                value={searchTerm}
                onChange={setSearchTerm}
              />
            </div>
          </CardHeader>

          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre Comercial</TableHead>
                  <TableHead>¿Acepta Crédito?</TableHead>
                  <TableHead>¿Visible para Empleados?</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                      {searchTerm
                        ? `No se encontraron proveedores con "${searchTerm}".`
                        : "No hay proveedores para mostrar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => {
                    const isEliminated = !!p.deletedAt;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{p.name}</span>
                            {!p.visible_to_employee && (
                              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                Oculto para empleados
                              </span>
                            )}
                            {isEliminated && (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
                                Eliminado
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${p.payment_condition === "Credito" || p.payment_condition === "Crédito"
                              ? "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800"
                              : "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              }`}
                          >
                            {p.payment_condition === "Credito" || p.payment_condition === "Crédito" ? "Sí" : "No"}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${p.visible_to_employee
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                              }`}
                          >
                            {p.visible_to_employee ? "Sí" : "No"}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              disabled={!canManage || isEliminated}
                              onClick={() => {
                                openModal(p)
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:bg-destructive/10"
                              disabled={!isAdmin || isEliminated}
                              onClick={() => {
                                setDeletingId(p.id)
                              }}
                              title={!isAdmin ? "Solo el administrador puede eliminar proveedores" : ""}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Controles de Paginación */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground font-medium">
                  Mostrando <span className="font-semibold text-foreground">{((page - 1) * limit) + 1}</span> a{" "}
                  <span className="font-semibold text-foreground">{Math.min(page * limit, total)}</span> de{" "}
                  <span className="font-semibold text-foreground">{total}</span> proveedores
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                    const isCurrent = p === page;
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
                      );
                    }
                    if (p === 2 || p === totalPages - 1) {
                      return <span key={p} className="text-muted-foreground px-1">...</span>;
                    }
                    return null;
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "Editar Proveedor" : "Registrar Nuevo Proveedor"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Nombre Comercial</Label>
              <Input
                id="p-name"
                required
                placeholder="Ej: Distribuidora Central"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-condition">¿Acepta Crédito?</Label>
              <select
                id="p-condition"
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none"
                value={formData.payment_condition === "Crédito" || formData.payment_condition === "Credito" ? "Credito" : "Contado"}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    payment_condition: e.target.value,
                    credit_days: e.target.value === "Contado" ? 0 : prev.credit_days,
                  }))
                }
              >
                <option value="Contado">No</option>
                <option value="Credito">Sí</option>
              </select>
            </div>



            <div className="flex items-center gap-2 pt-1 bg-muted/20 border border-border/40 rounded-lg p-2.5">
              <input
                id="p-visibility"
                type="checkbox"
                className="size-4 rounded border-input bg-background accent-emerald-600 focus:ring-emerald-500"
                checked={formData.visible_to_employee}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, visible_to_employee: e.target.checked }))
                }
              />
              <Label htmlFor="p-visibility" className="text-sm font-medium cursor-pointer text-foreground select-none">
                Mostrar a empleados al registrar egresos
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : formData.id ? (
                  "Guardar Cambios"
                ) : (
                  "Registrar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => { if (!open) setDeletingId(null) }}
        title="Eliminar Proveedor"
        description="¿Estás seguro de que querés eliminar este proveedor? Esta acción es irreversible y eliminará permanentemente el registro del sistema."
        confirmLabel="Eliminar Proveedor"
        loading={isDeleteLoading}
        onConfirm={handleDelete}
      />
    </div>
  )
}