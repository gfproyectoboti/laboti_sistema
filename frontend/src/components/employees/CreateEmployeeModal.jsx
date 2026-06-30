import { useState } from "react"
import api from "@/api/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, UserCog, ShieldCheck } from "lucide-react"

export default function CreateEmployeeModal({ open, onOpenChange, onSuccess, onError }) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    salary_type: "hourly",
    hourly_rate: 0,
    monthly_salary: 0,
    role: "EMPLOYEE",
  })
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)

    const cleanUsername = form.username.trim()
    const cleanFirstName = form.first_name.trim()
    const cleanLastName = form.last_name.trim()
    const cleanEmail = form.email.trim()

    if (!cleanFirstName || !cleanLastName) {
      setLocalError("El nombre y apellido son obligatorios y no pueden contener solo espacios.")
      return
    }

    const usernameRegex = /^[a-zA-Z0-9_.]+$/
    if (!usernameRegex.test(cleanUsername)) {
      setLocalError("El nombre de usuario solo puede contener letras, números, guiones bajos (_) o puntos (.)")
      return
    }

    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(cleanEmail)) {
        setLocalError("Debe ingresar un correo electrónico válido.")
        return
      }
    }

    if (form.password.length < 8) {
      setLocalError("La contraseña inicial debe tener al menos 8 caracteres.")
      return
    }

    if (form.role !== "MANAGER") {
      if (form.salary_type === "hourly" && (Number(form.hourly_rate) <= 0 || isNaN(form.hourly_rate))) {
        setLocalError("La tarifa por hora debe ser un número mayor a 0.")
        return
      }

      if (form.salary_type === "fixed" && (Number(form.monthly_salary) <= 0 || isNaN(form.monthly_salary))) {
        setLocalError("El sueldo mensual fijo debe ser un número mayor a 0.")
        return
      }
    }

    setLoading(true)
    try {
      const payload = {
        ...form,
        username: cleanUsername,
        first_name: cleanFirstName,
        last_name: cleanLastName,
        email: cleanEmail || null,
        hourly_rate: Number(form.hourly_rate),
        monthly_salary: form.salary_type === "fixed" ? Number(form.monthly_salary) : null,
        role: form.role,
      }
      await api.post("/admin/employees", payload)
      setForm({
        username: "",
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        salary_type: "hourly",
        hourly_rate: 0,
        monthly_salary: 0,
        role: "EMPLOYEE",
      })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      const errMsg = err.response?.data?.errors?.[0]?.message || err.response?.data?.message || "Error al registrar el empleado";
      setLocalError(errMsg);
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) setLocalError(null)
      onOpenChange(val)
    }}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-5 text-primary" />
              Registrar Nuevo Empleado
            </DialogTitle>
            <DialogDescription>
              Crea un nuevo usuario del tipo personal y configura su salario inicial.
            </DialogDescription>
            {localError && (
              <div className="mt-2 rounded bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                {localError}
              </div>
            )}
          </DialogHeader>

          <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="c-first-name">Nombre</Label>
                  <Input
                    id="c-first-name"
                    required
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-last-name">Apellido</Label>
                  <Input
                    id="c-last-name"
                    required
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  />
                </div>
              </div>

            <div className="space-y-2">
              <Label htmlFor="c-username">Nombre de Usuario</Label>
              <Input
                id="c-username"
                required
                placeholder="ej: juanperez"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="c-email">Correo Electrónico (Opcional)</Label>
              <Input
                id="c-email"
                type="email"
                placeholder="ej: empleado@empresa.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="c-password">Contraseña inicial</Label>
              <Input
                id="c-password"
                type="password"
                required
                placeholder="Min 8 caracteres"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            {/* Tipo de contrato y salario — solo para EMPLOYEE */}
            {form.role !== "MANAGER" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="c-salary-type">Tipo de Contrato</Label>
                  <select
                    id="c-salary-type"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none"
                    value={form.salary_type}
                    onChange={(e) => setForm({ ...form, salary_type: e.target.value })}
                  >
                    <option value="hourly">Por hora</option>
                    <option value="fixed">Sueldo Fijo Mensual</option>
                  </select>
                </div>

                {form.salary_type === "hourly" ? (
                  <div className="space-y-2">
                    <Label htmlFor="c-hourly-rate">Tarifa por hora ($)</Label>
                    <Input
                      id="c-hourly-rate"
                      type="number"
                      min="0"
                      required
                      value={form.hourly_rate || ""}
                      onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="c-monthly-salary">Sueldo Fijo Mensual ($)</Label>
                    <Input
                      id="c-monthly-salary"
                      type="number"
                      min="0"
                      required
                      value={form.monthly_salary || ""}
                      onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })}
                    />
                  </div>
                )}
              </>
            )}

            {/* Selector de Rol: Encargado (MANAGER) */}
            <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <input
                id="c-role-manager"
                type="checkbox"
                className="mt-0.5 size-4 rounded border-input bg-background accent-amber-600 focus:ring-amber-500"
                checked={form.role === "MANAGER"}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.checked ? "MANAGER" : "EMPLOYEE" })
                }
              />
              <div>
                <Label htmlFor="c-role-manager" className="text-sm font-medium cursor-pointer text-foreground select-none flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-amber-500" />
                  Hacer Encargado
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  El encargado tiene acceso a todas las funcionalidades del panel de administración.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-3 sm:gap-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin mr-2" />}
              Registrar Empleado
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
