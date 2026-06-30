import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Loader2 } from "lucide-react"

/**
 * Componente de ruta protegida.
 *
 * @param {React.ReactNode} children — Componente hijo a renderizar
 * @param {string} [requiredRole] — Rol requerido ("ADMIN" o "EMPLOYEE"). Si no se pasa, cualquier usuario logueado accede.
 * @param {string} [requiredPermission] — Permiso requerido (ej: "canRegisterClosures"). ADMIN siempre pasa.
 */
export function ProtectedRoute({ children, requiredRole, requiredPermission }) {
  const { user, loading, hasPermission, mustChangePassword } = useAuth()
  const location = useLocation()

  // Mientras el contexto se inicializa, mostramos un loader sutil
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Sin usuario → al login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Si debe cambiar su contraseña y no está en la ruta de cambio
  if (mustChangePassword && location.pathname !== "/cambiar-contrasena") {
    return <Navigate to="/cambiar-contrasena" replace />
  }

  // Si ya cambió la contraseña y quiere ingresar manualmente a cambiar-contrasena
  if (!mustChangePassword && location.pathname === "/cambiar-contrasena") {
    return <Navigate to="/dashboard" replace />
  }

  // Si se requiere un rol específico y el usuario no lo tiene → al dashboard
  if (requiredRole && user.role !== requiredRole) {
    // MANAGER tiene acceso a las rutas que requieren ADMIN
    if (requiredRole === "ADMIN" && user.role === "MANAGER") {
      // permitido
    } else {
      return <Navigate to="/dashboard" replace />
    }
  }

  // Si se requiere un permiso específico y no lo tiene → al dashboard
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/dashboard" replace />
  }

  // Todo ok → renderizar el contenido protegido
  return children
}
