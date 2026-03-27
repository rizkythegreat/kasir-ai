export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  sku: string
  categoryId: string
  category: {
    id: string
    name: string
  }
}

export interface CartItem extends Product {
  quantity: number
}

export interface Transaction {
  id: string
  invoiceNumber: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  paymentMethod: string
  amountPaid: number
  changeAmount: number
  status: string
  items: TransactionItem[]
  createdAt: Date
}

export interface TransactionItem {
  id: string
  productId: string
  productName: string
  productSku: string
  quantity: number
  unitPrice: number
  subtotal: number
}