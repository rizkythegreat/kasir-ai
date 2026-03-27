'use client'

import { memo } from 'react'
import { Plus, Package, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  sku: string
  category: {
    id: string
    name: string
  }
}

interface CartItem extends Product {
  quantity: number
}

interface ProductGridProps {
  products: Product[]
  onAddToCart: (product: Product) => void
  isLoading?: boolean
  cartItems?: CartItem[]
}

// Memoize product card untuk performa
const ProductCard = memo(function ProductCard({
  product,
  onAdd,
  inCartQuantity
}: {
  product: Product
  onAdd: () => void
  inCartQuantity: number
}) {
  const isLowStock = product.stock <= 10
  const isOutOfStock = product.stock === 0
  const remainingStock = product.stock - inCartQuantity

  return (
    <div
      className={cn(
        "group relative p-4 rounded-xl border bg-card transition-all",
        "hover:shadow-md hover:border-primary/30",
        isOutOfStock && "opacity-60"
      )}
    >
      {/* Category Badge */}
      <Badge
        variant="secondary"
        className="absolute top-2 right-2 text-[10px]"
      >
        {product.category.name}
      </Badge>

      {/* Product Icon/Image Placeholder */}
      <div className="h-16 w-16 mx-auto mb-3 rounded-lg bg-muted flex items-center justify-center">
        <Package className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Product Info */}
      <div className="text-center mb-3">
        <h3 className="font-medium text-sm line-clamp-2 min-h-10">
          {product.name}
        </h3>
        <p className="text-lg font-bold text-primary mt-1">
          {formatCurrency(product.price)}
        </p>
      </div>

      {/* Stock Info */}
      <div className="flex items-center justify-center gap-1 mb-3">
        {isOutOfStock ? (
          <Badge variant="destructive" className="text-[10px]">
            Habis
          </Badge>
        ) : isLowStock ? (
          <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Sisa {remainingStock}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">
            Stok: {remainingStock}
          </span>
        )}

        {inCartQuantity > 0 && (
          <Badge className="text-[10px] ml-1">
            {inCartQuantity} di keranjang
          </Badge>
        )}
      </div>

      {/* Add Button */}
      <Button
        size="sm"
        className="w-full"
        onClick={onAdd}
        disabled={remainingStock <= 0}
      >
        <Plus className="h-4 w-4 mr-1" />
        Tambah
      </Button>
    </div>
  )
})

export function ProductGrid({
  products,
  onAddToCart,
  isLoading = false,
  cartItems = []
}: ProductGridProps) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl border">
            <Skeleton className="h-16 w-16 mx-auto mb-3 rounded-lg" />
            <Skeleton className="h-4 w-3/4 mx-auto mb-2" />
            <Skeleton className="h-6 w-1/2 mx-auto mb-3" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    )
  }

  // Empty state
  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">
          Tidak ada produk ditemukan
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Coba kata kunci pencarian lain
        </p>
      </div>
    )
  }

  // Get quantity in cart for each product
  const getInCartQuantity = (productId: string) => {
    const item = cartItems.find(i => i.id === productId)
    return item?.quantity || 0
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onAdd={() => onAddToCart(product)}
          inCartQuantity={getInCartQuantity(product.id)}
        />
      ))}
    </div>
  )
}