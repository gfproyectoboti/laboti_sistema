import { useState, useEffect } from "react"
import api from "@/api/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, DollarSign, ShieldAlert } from "lucide-react"

export default function LiquidateModal({ open, onOpenChange, summaryItem, from, to, onSuccess, onError }) {
  const [providers, setProviders] = useState([])
  const [accounts, setAccounts] = useState([])
  const [selectedProvider, setSelectedProvider] = useState("")
  const [selectedAccount, setSelectedAccount] = useState("")
  const [budgetCategory, setBudgetCategory] = useState("Gastos Fijos")
  const [discountAmount, setDiscountAmount] = useState("")

  const [loadingLists, setLoadingLists] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const rawAmount = summaryItem?.calculatedAmount || 0;
  const parsedDiscount = Number(discountAmount) || 0;
  const finalAmount = Math.max(0, rawAmount - parsedDiscount);

  // Fetch providers and accounts when modal opens
  useEffect(() => {
    if (open) {
      const fetchData = async () => {
        setLoadingLists(true)
        try {
          const [provRes, accRes] = await Promise.all([
            api.get("/providers"),
            api.get("/accounts"),
          ])

          const provs = Array.isArray(provRes.data)
            ? provRes.data
            : provRes.data?.data ?? []

          const accs = Array.isArray(accRes.data)
            ? accRes.data
            : accRes.data?.data ?? []

          setProviders(provs)
          setAccounts(accs)

          if (provs.length > 0) setSelectedProvider(String(provs[0].id))
          if (accs.length > 0) setSelectedAccount(String(accs[0].id))
        } catch (err) {
          console.error("Error cargando listados para liquidación:", err)
        } finally {
          setLoadingLists(false)
        }
      }
      fetchData()
    }
  }, [open])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!summaryItem) return
    setSubmitting(true)
    try {
      const payload = {
        employeeId: Number(summaryItem.employeeId),
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        providerId: Number(selectedProvider),
        accountId: Number(selectedAccount),
        budgetCategory,
        discountAmount: parsedDiscount,
      }

      const res = await api.post("/attendance/liquidate", payload)
      onOpenChange(false)
      onSuccess(res.data.message || "Liquidación procesada con éxito")
    } catch (err) {
      onError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || "Error al procesar la liquidación")
    } finally {
      setSubmitting(false)
    }
  }

  const formatMoney = (val) => {
    return Number(val).toLocaleString("es-CL", {
      style: "currency",
      currency: "CLP",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <DollarSign className="size-5" />
              Procesar Liquidación
            </DialogTitle>
            <DialogDescription>
              Creá un egreso pendiente para pagar el sueldo acumulado de{" "}
              <span className="font-semibold text-foreground">{summaryItem?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          {/* Información del sueldo a liquidar */}
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2.5 my-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tipo de Contrato:</span>
              <span className="font-semibold capitalize">
                {summaryItem?.salaryType === "hourly" ? "Por Hora" : "Sueldo Fijo"}
              </span>
            </div>
            {summaryItem?.salaryType === "hourly" && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Horas Acumuladas:</span>
                <span className="font-semibold">{summaryItem?.totalHours} hs</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sueldo Bruto:</span>
              <span className="font-semibold">{formatMoney(rawAmount)}</span>
            </div>
            
            <div className="flex justify-between text-sm items-center">
              <Label htmlFor="discount" className="text-muted-foreground font-normal">Descuento (Vales/Adelantos):</Label>
              <div className="relative w-32">
                <span className="absolute left-2.5 top-1.5 text-xs text-muted-foreground">$</span>
                <input
                  id="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  max={rawAmount > 0.01 ? rawAmount - 0.01 : 0}
                  className="w-full rounded-md border bg-background pl-6 pr-2 py-1 text-sm focus:outline-none text-right font-medium text-destructive [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex justify-between text-sm items-center border-t pt-2 mt-2">
              <span className="text-muted-foreground font-medium">Sueldo Neto a Pagar:</span>
              <span className="font-bold text-lg text-emerald-500">
                {formatMoney(finalAmount)}
              </span>
            </div>
          </div>

          <div className="space-y-4 py-3">
            {loadingLists ? (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Cargando proveedores y cuentas...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="l-provider">Proveedor Asociado</Label>
                  <select
                    id="l-provider"
                    required
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none"
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                  >
                    {providers.length === 0 ? (
                      <option value="">No hay proveedores cargados</option>
                    ) : (
                      providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.payment_condition})
                        </option>
                      ))
                    )}
                  </select>
                  {providers.length === 0 && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <ShieldAlert className="size-3" />
                      Debes registrar un proveedor en el panel de Proveedores antes de liquidar haberes.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="l-account">Cuenta Física de Pago</Label>
                  <select
                    id="l-account"
                    required
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none"
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                  >
                    {accounts.length === 0 ? (
                      <option value="">No hay cuentas registradas</option>
                    ) : (
                      accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (Saldo: {formatMoney(a.balance)})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="l-category">Bolsa de Presupuesto</Label>
                  <select
                    id="l-category"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none"
                    value={budgetCategory}
                    onChange={(e) => setBudgetCategory(e.target.value)}
                  >
                    <option value="Gastos Fijos">Gastos Fijos</option>
                    <option value="Mercadería">Mercadería</option>
                    <option value="Ahorro">Ahorro</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="mt-2 gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || loadingLists || providers.length === 0 || accounts.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
              Efectivizar Liquidación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
