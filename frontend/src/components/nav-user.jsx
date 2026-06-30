"use client"

import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import {
  ChevronsUpDown,
  LogOut,
  Shield,
  User,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavUser({ user }) {
  const { isMobile } = useSidebar()
  const { logout, employeeCheckOutAndLogout, attendanceStatus } = useAuth()
  const navigate = useNavigate()

  // Generar iniciales del nombre de usuario (máx 2 letras)
  const initials = (user.name || "U")
    .split(/[\s_-]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const rolLabel = user.role === "ADMIN" ? "Administrador" : user.role === "MANAGER" ? "Encargado" : "Empleado"

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const handleCheckOutAndLogout = async () => {
    await employeeCheckOutAndLogout()
    navigate("/login")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary/15 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{rolLabel}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-primary/15 text-primary text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {user.role === "ADMIN" || user.role === "MANAGER" ? (
                      <Shield className="size-3 text-amber-500" />
                    ) : (
                      <User className="size-3" />
                    )}
                    {rolLabel}
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user.role === "EMPLOYEE" && attendanceStatus?.hasActiveSession && (
              <>
                <DropdownMenuItem onClick={handleCheckOutAndLogout} className="text-amber-500 focus:text-amber-500 gap-2">
                  <LogOut className="size-4 text-amber-500" />
                  Registrar Salida y Salir
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive gap-2">
              <LogOut className="size-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
