'use client'

import { useState } from 'react'
import {
  Banknote,
  CreditCard,
  QrCode,
  Building2,
  Loader2,
  CheckCircle2,
  Calculator
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  sku: string
}

interface PaymentDialogProps {
  open: boolean
  onClose: () => void
  items: CartItem[]
  subtotal: number
  tax: number
  total: number
  onSuccess: (transactionData: any) => void
}

type PaymentMethod = 'cash' | 'qris' | 'card' | 'transfer'

const paymentMethods: { id: PaymentMethod; label: string; icon: any }[] = [
  { id: 'cash', label: 'Tunai', icon: Banknote },
  { id: 'qris', label: 'QRIS', icon: QrCode },
  { id: 'card', label: 'Kartu', icon: CreditCard },
  { id: 'transfer', label: 'Transfer', icon: Building2 },
]

export function PaymentDialog({
  open,
  onClose,
  items,
  subtotal,
  tax,
  total,
  onSuccess
}: PaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [amountPaid, setAmountPaid] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const amountPaidNum = parseFloat(amountPaid) || 0
  const change = amountPaidNum - total
  const canPay = paymentMethod !== 'cash' || amountPaidNum >= total

  // Quick amount buttons untuk cash
  const quickAmounts = [
    { label: 'Pas', value: total },
    { label: formatCurrency(50000), value: 50000 },
    { label: formatCurrency(100000), value: 100000 },
    { label: formatCurrency(150000), value: 150000 },
  ].filter(q => q.value >= total || q.label === 'Pas')

  const handlePayment = async () => {
    if (!canPay) return

    setIsProcessing(true)

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            productId: item.id,
            productName: item.name,
            productSku: item.sku,
            quantity: item.quantity,
            unitPrice: item.price,
            subtotal: item.price * item.quantity
          })),
          subtotal,
          taxAmount: tax,
          taxPercent: 10,
          total,
          paymentMethod,
          amountPaid: paymentMethod === 'cash' ? amountPaidNum : total,
          changeAmount: paymentMethod === 'cash' ? Math.max(0, change) : 0
        })
      })

      if (!res.ok) {
        throw new Error('Transaction failed')
      }

      const data = await res.json()

      setIsSuccess(true)

      // Wait a moment to show success state
      setTimeout(() => {
        onSuccess(data.transaction)
        resetState()
      }, 1500)

    } catch (error) {
      console.error('Payment error:', error)
      alert('Terjadi kesalahan saat memproses pembayaran')
    } finally {
      setIsProcessing(false)
    }
  }

  const resetState = () => {
    setPaymentMethod('cash')
    setAmountPaid('')
    setIsSuccess(false)
  }

  const handleClose = () => {
    if (!isProcessing) {
      resetState()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pembayaran</DialogTitle>
        </DialogHeader>

        {isSuccess ? (
          // Success State
          <div className="py-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Pembayaran Berhasil!</h3>
            <p className="text-muted-foreground">Transaksi sedang diproses...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal ({items.length} item)</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PPN 10%</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Metode Pembayaran
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {paymentMethods.map(method => {
                  const Icon = method.icon
                  return (
                    <Button
                      key={method.id}
                      variant={paymentMethod === method.id ? 'default' : 'outline'}
                      className={cn(
                        "flex-col h-auto py-3",
                        paymentMethod === method.id && "ring-2 ring-primary"
                      )}
                      onClick={() => setPaymentMethod(method.id)}
                    >
                      <Icon className="h-5 w-5 mb-1" />
                      <span className="text-xs">{method.label}</span>
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Cash Payment Input */}
            {paymentMethod === 'cash' && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="amount" className="text-sm font-medium">
                    Jumlah Dibayar
                  </Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      Rp
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="pl-10 text-lg font-mono"
                    />
                  </div>
                </div>

                {/* Quick Amounts */}
                <div className="flex flex-wrap gap-2">
                  {quickAmounts.map(q => (
                    <Button
                      key={q.label}
                      variant="outline"
                      size="sm"
                      onClick={() => setAmountPaid(q.value.toString())}
                    >
                      {q.label}
                    </Button>
                  ))}
                </div>

                {/* Change Display */}
                {amountPaidNum > 0 && (
                  <div className={cn(
                    "p-3 rounded-lg text-center",
                    change >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  )}>
                    <div className="flex items-center justify-center gap-2">
                      <Calculator className="h-4 w-4" />
                      <span className="font-medium">
                        {change >= 0
                          ? `Kembalian: ${formatCurrency(change)}`
                          : `Kurang: ${formatCurrency(Math.abs(change))}`
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Non-cash Payment Info */}
            {paymentMethod !== 'cash' && (
              <div className="p-4 rounded-lg bg-blue-50 text-blue-700 text-sm text-center">
                {paymentMethod === 'qris' && 'Scan QR code untuk pembayaran'}
                {paymentMethod === 'card' && 'Tap atau insert kartu pada mesin EDC'}
                {paymentMethod === 'transfer' && 'Transfer ke rekening toko'}
              </div>
            )}

            {/* Pay Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handlePayment}
              disabled={!canPay || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                `Bayar ${formatCurrency(total)}`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}