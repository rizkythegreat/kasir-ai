'use client'

import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  stock: number
}

interface CartProps {
  items: CartItem[]
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
  onClear: () => void
}

export function Cart({ items, onUpdateQuantity, onRemove, onClear }: CartProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground text-center">
          Keranjang kosong
        </p>
        <p className="text-sm text-muted-foreground text-center mt-1">
          Klik produk untuk menambahkan
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Clear Button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Kosongkan
        </Button>
      </div>

      {/* Cart Items */}
      {items.map(item => (
        <div
          key={item.id}
          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
        >
          {/* Item Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{item.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(item.price)}
            </p>
          </div>

          {/* Quantity Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            >
              <Minus className="h-3 w-3" />
            </Button>

            <span className="w-8 text-center font-medium">
              {item.quantity}
            </span>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              disabled={item.quantity >= item.stock}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Subtotal */}
          <div className="text-right min-w-20">
            <p className="font-semibold text-sm">
              {formatCurrency(item.price * item.quantity)}
            </p>
          </div>

          {/* Remove Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}