import * as React from "react"
import {
  Building2,
  ClipboardList,
  GalleryVerticalEnd,
  LayoutDashboard,
  LineChart,
  ReceiptText,
  Users,
  CalendarClock,
  Sliders,
  ShieldAlert,
  TrendingUp,
} from "lucide-react"

import { useAuth } from "@/context/AuthContext"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

/**
 * Sidebar de la aplicación.
 * Filtra dinámicamente las opciones del menú según el rol y permisos del usuario.
 */
export function AppSidebar({ ...props }) {
  const { user, isAdmin, isManager, hasPermission } = useAuth()

  const navMain = React.useMemo(() => {
    const items = []

    // Panel Principal — visible para todos
    items.push({
      title: "Panel Principal",
      url: "/dashboard",
      icon: LayoutDashboard,
      isActive: true,
    })

    // Cierres de Caja — ADMIN siempre, EMPLOYEE si tiene permiso
    if (hasPermission("canRegisterClosures")) {
      items.push({
        title: "Cierres de Caja",
        url: "/cierres",
        icon: ClipboardList,
      })
    }

    // Proveedores — ADMIN siempre, EMPLOYEE si tiene permiso
    if (hasPermission("canManageProviders")) {
      items.push({
        title: "Proveedores",
        url: "/proveedores",
        icon: Building2,
      })
    }

    // Egresos — ADMIN siempre, EMPLOYEE si tiene algún permiso de gastos
    if (hasPermission("canRegisterExpenses") || hasPermission("canPayExpenses")) {
      items.push({
        title: "Egresos",
        url: "/egresos",
        icon: ReceiptText,
      })
    }

    // --- Secciones solo para ADMIN ---
    if (isAdmin) {
      items.push({
        title: "Empleados",
        url: "/empleados",
        icon: Users,
      })

      items.push({
        title: "Asistencia",
        url: "/asistencia",
        icon: CalendarClock,
      })

      items.push({
        title: "Reportes",
        url: "/reportes",
        icon: LineChart,
      })

      items.push({
        title: "Proyección",
        url: "/proyeccion",
        icon: TrendingUp,
      })

      items.push({
        title: "Distribución",
        url: "/distribucion",
        icon: Sliders,
      })

      items.push({
        title: "Auditoría",
        url: "/auditoria",
        icon: ShieldAlert,
      })
    }

    return items
  }, [isAdmin, hasPermission])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="hover:bg-transparent cursor-default">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <GalleryVerticalEnd className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Gestor Financiero</span>
                <span className="truncate text-xs text-muted-foreground">
                  {isManager ? "Encargado" : isAdmin ? "Administrador" : "Empleado"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.username || "Usuario",
            role: user?.role || "EMPLOYEE",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
