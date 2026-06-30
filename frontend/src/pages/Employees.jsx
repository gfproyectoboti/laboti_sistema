import { useState, useEffect } from "react"
import api from "@/api/api"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Loader2,
  Plus,
  Trash2,
  ShieldAlert,
  UserCheck,
  UserX,
  DollarSign,
  Key,
  MoreVertical,
  Link as LinkIcon,
} from "lucide-react"

// Componentes modulares
import CreateEmployeeModal from "@/components/employees/CreateEmployeeModal"
import EditProfileModal from "@/components/employees/EditProfileModal"
import EditPermissionsModal from "@/components/employees/EditPermissionsModal"
import DeleteEmployeeModal from "@/components/employees/DeleteEmployeeModal"
import ResetPasswordModal from "@/components/employees/ResetPasswordModal"
import { SearchBar } from "@/components/ui/search-bar"

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")

  // --- Modales States ---
  const [createOpen, setCreateOpen] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [editPermissionsOpen, setEditPermissionsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  // --- Seleccionado State ---
  const [selectedEmp, setSelectedEmp] = useState(null)

  // --- Filtrado de Personal ---
  const filteredEmployees = employees.filter((emp) => {
    const profile = emp.employeeProfile || {}
    const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.toLowerCase()
    const username = (emp.username || "").toLowerCase()
    const term = searchTerm.trim().toLowerCase()
    return fullName.includes(term) || username.includes(term)
  })

  // --- Fetch inicial ---
  const fetchEmployees = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get("/admin/employees")
      setEmployees(res.data.data ?? [])
    } catch (err) {
      setError(err.response?.data?.message || "Error al cargar la lista de empleados")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  const formatMoney = (value) => {
    return Number(value).toLocaleString("es-CL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel de Empleados</h1>
          <p className="text-sm text-muted-foreground">
            Administrá perfiles, salarios y permisos de accesibilidad del personal.
          </p>
        </div>
        <Button className="gap-2 w-full sm:w-auto justify-center" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Nuevo Empleado
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <ShieldAlert className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Tabla vacía */}
      {!loading && employees.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted mb-4">
              <UserX className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No hay empleados registrados</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Agregá personal para asignarle permisos y registrar su asistencia.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabla con listado */}
      {!loading && employees.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
                  <UserCheck className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Listado del Personal</CardTitle>
                  <CardDescription>
                    {employees.length} empleado{employees.length !== 1 ? "s" : ""} registrado{employees.length !== 1 ? "s" : ""}
                  </CardDescription>
                </div>
              </div>
              <SearchBar
                placeholder="Buscar empleado..."
                value={searchTerm}
                onChange={setSearchTerm}
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Tipo de Contrato</TableHead>
                  <TableHead>Remuneración</TableHead>
                  <TableHead>Permisos Activos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      {searchTerm
                        ? `No se encontraron empleados con "${searchTerm}".`
                        : "No hay empleados registrados."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => {
                    const profile = emp.employeeProfile || {}
                    const perms = emp.employeePermission || {}
                    return (
                      <TableRow key={emp.id}>
                        <TableCell>
                          <div>
                            <p className="font-semibold">
                              {profile.first_name} {profile.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              @{emp.username} {emp.email && `• ${emp.email}`}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="capitalize text-sm font-medium">
                            {emp.role === "MANAGER" ? "N/A" : (profile.salary_type === "hourly" ? "Por Hora" : "Sueldo Fijo")}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {emp.role === "MANAGER" ? (
                            <span className="text-muted-foreground">-</span>
                          ) : profile.salary_type === "hourly" ? (
                            <span>${formatMoney(profile.hourly_rate)} / hr</span>
                          ) : (
                            <span>${formatMoney(profile.monthly_salary || 0)} / mes</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {emp.role === "MANAGER" ? (
                              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                Encargado (Acceso Total)
                              </span>
                            ) : (
                              <>
                                {perms.canRegisterClosures && (
                                  <span className="rounded bg-sky-500/10 px-2 py-0.5 text-xs font-semibold text-sky-500">
                                    Cierres
                                  </span>
                                )}
                                {perms.canRegisterExpenses && (
                                  <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500">
                                    Gastos
                                  </span>
                                )}
                                {perms.canPayExpenses && (
                                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500">
                                    Pagar Egresos
                                  </span>
                                )}
                                {perms.canManageProviders && (
                                  <span className="rounded bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-500">
                                    Proveedores
                                  </span>
                                )}
                                {!perms.canRegisterClosures &&
                                  !perms.canRegisterExpenses &&
                                  !perms.canPayExpenses &&
                                  !perms.canManageProviders && (
                                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                      Sin permisos
                                    </span>
                                  )}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {/* Vista Desktop: Botones de acción directos */}
                          <div className="hidden md:flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar Remuneración"
                              onClick={() => {
                                setSelectedEmp(emp)
                                setEditProfileOpen(true)
                              }}
                            >
                              <DollarSign className="size-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              title="Modificar Permisos"
                              onClick={() => {
                                setSelectedEmp(emp)
                                setEditPermissionsOpen(true)
                              }}
                            >
                              <Key className="size-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              title="Generar Enlace de Clave"
                              onClick={() => {
                                setSelectedEmp(emp)
                                setResetOpen(true)
                              }}
                            >
                              <LinkIcon className="size-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              title="Eliminar Empleado"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setSelectedEmp(emp)
                                setDeleteOpen(true)
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>

                          {/* Vista Mobile: Menú desplegable con tres puntos verticales */}
                          <div className="md:hidden flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8">
                                  <MoreVertical className="size-4" />
                                  <span className="sr-only">Acciones</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedEmp(emp)
                                    setEditProfileOpen(true)
                                  }}
                                >
                                  <DollarSign className="size-4 mr-2" />
                                  Editar Remuneración
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedEmp(emp)
                                    setEditPermissionsOpen(true)
                                  }}
                                >
                                  <Key className="size-4 mr-2" />
                                  Modificar Permisos
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedEmp(emp)
                                    setResetOpen(true)
                                  }}
                                >
                                  <LinkIcon className="size-4 mr-2" />
                                  Generar Enlace de Clave
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    setSelectedEmp(emp)
                                    setDeleteOpen(true)
                                  }}
                                >
                                  <Trash2 className="size-4 mr-2" />
                                  Eliminar Empleado
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modales Modularizados */}
      <CreateEmployeeModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={fetchEmployees}
        onError={setError}
      />

      <EditProfileModal
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
        employee={selectedEmp}
        onSuccess={fetchEmployees}
        onError={setError}
      />

      <EditPermissionsModal
        open={editPermissionsOpen}
        onOpenChange={setEditPermissionsOpen}
        employee={selectedEmp}
        onSuccess={fetchEmployees}
        onError={setError}
      />

      <DeleteEmployeeModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        employee={selectedEmp}
        onSuccess={fetchEmployees}
        onError={setError}
      />

      <ResetPasswordModal
        open={resetOpen}
        onOpenChange={setResetOpen}
        employee={selectedEmp}
      />
    </div>
  )
}