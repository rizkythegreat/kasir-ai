import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'

// ============================================
// TOOL 1: SEARCH PRODUCTS
// ============================================
const searchProductsTool = tool(
  async ({ query, category, maxPrice, minPrice, limit }) => {
    try {
      // Build where clause dynamically
      const whereClause: any = {
        isActive: true,
        stock: { gt: 0 }
      }

      // Text search
      if (query && query.trim()) {
        whereClause.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      }

      // Category filter
      if (category) {
        whereClause.category = {
          name: { equals: category, mode: 'insensitive' }
        }
      }

      // Price filters
      if (minPrice !== undefined || maxPrice !== undefined) {
        whereClause.price = {}
        if (minPrice !== undefined) whereClause.price.gte = minPrice
        if (maxPrice !== undefined) whereClause.price.lte = maxPrice
      }

      const products = await prisma.product.findMany({
        where: whereClause,
        include: { category: true },
        take: limit || 10,
        orderBy: { name: 'asc' }
      })

      if (products.length === 0) {
        return 'Tidak ada produk yang ditemukan dengan kriteria tersebut.'
      }

      // Format response for AI
      const formatted = products.map(p =>
        `• ${p.name} (${p.category.name}) - ${formatCurrency(p.price)} - Stok: ${p.stock}`
      ).join('\\n')

      return `Ditemukan ${products.length} produk:\\n${formatted}`
    } catch (error) {
      console.error('Search tool error:', error)
      return 'Terjadi kesalahan saat mencari produk.'
    }
  },
  {
    name: 'search_products',
    description: 'Cari produk berdasarkan keyword, kategori, atau range harga. Gunakan tool ini ketika user ingin mencari atau melihat produk.',
    schema: z.object({
      query: z.string().optional().describe('Kata kunci pencarian (nama atau deskripsi produk)'),
      category: z.string().optional().describe('Filter berdasarkan kategori: Kopi, Non-Kopi, Makanan, atau Snack'),
      minPrice: z.number().optional().describe('Harga minimum dalam Rupiah'),
      maxPrice: z.number().optional().describe('Harga maksimum dalam Rupiah'),
      limit: z.number().optional().describe('Jumlah maksimal hasil (default 10)')
    })
  }
)

// ============================================
// TOOL 2: CHECK STOCK
// ============================================
const checkStockTool = tool(
  async ({ productName, checkLowStock }) => {
    try {
      if (checkLowStock) {
        // Get all products with low stock
        const lowStockProducts = await prisma.product.findMany({
          where: {
            isActive: true,
            stock: { lte: prisma.product.fields.minStock }
          },
          include: { category: true },
          orderBy: { stock: 'asc' }
        })

        // Fallback: get products with stock <= 10 if the above doesn't work
        const products = lowStockProducts.length > 0
          ? lowStockProducts
          : await prisma.product.findMany({
              where: {
                isActive: true,
                stock: { lte: 10 }
              },
              include: { category: true },
              orderBy: { stock: 'asc' }
            })

        if (products.length === 0) {
          return '✅ Semua produk stoknya aman! Tidak ada yang perlu di-restock.'
        }

        const formatted = products.map(p => {
          const status = p.stock === 0 ? '🔴 HABIS' : p.stock <= 5 ? '🟠 KRITIS' : '🟡 MENIPIS'
          return `${status} ${p.name}: ${p.stock} unit`
        }).join('\\n')

        return `⚠️ Produk dengan stok menipis:\\n${formatted}\\n\\nRekomendasi: Segera lakukan restock untuk produk dengan status KRITIS dan HABIS.`
      }

      // Search specific product
      if (!productName) {
        return 'Mohon sebutkan nama produk yang ingin dicek stoknya, atau tanya "stok menipis" untuk melihat semua produk yang perlu restock.'
      }

      const products = await prisma.product.findMany({
        where: {
          name: { contains: productName, mode: 'insensitive' },
          isActive: true
        },
        include: { category: true }
      })

      if (products.length === 0) {
        return `Produk "${productName}" tidak ditemukan. Coba kata kunci lain?`
      }

      const formatted = products.map(p => {
        let status = '✅ Aman'
        if (p.stock === 0) status = '🔴 HABIS'
        else if (p.stock <= 5) status = '🟠 Stok kritis'
        else if (p.stock <= 10) status = '🟡 Stok menipis'

        return `${p.name}:\\n  Stok: ${p.stock} unit (${status})\\n  Kategori: ${p.category.name}\\n  Harga: ${formatCurrency(p.price)}`
      }).join('\\n\\n')

      return formatted
    } catch (error) {
      console.error('Check stock tool error:', error)
      return 'Terjadi kesalahan saat mengecek stok.'
    }
  },
  {
    name: 'check_stock',
    description: 'Cek stok produk tertentu atau lihat semua produk dengan stok menipis. Gunakan checkLowStock=true untuk melihat produk yang perlu restock.',
    schema: z.object({
      productName: z.string().optional().describe('Nama produk yang ingin dicek stoknya'),
      checkLowStock: z.boolean().optional().describe('Set true untuk melihat semua produk dengan stok menipis')
    })
  }
)

// ============================================
// TOOL 3: CALCULATE DISCOUNT
// ============================================
const calculateDiscountTool = tool(
  async ({ subtotal, discountType, discountValue }) => {
    try {
      let discountAmount = 0
      let discountDescription = ''

      if (discountType === 'percent') {
        if (discountValue > 100) {
          return 'Diskon tidak boleh lebih dari 100%'
        }
        discountAmount = subtotal * (discountValue / 100)
        discountDescription = `${discountValue}%`
      } else {
        if (discountValue > subtotal) {
          return 'Diskon tidak boleh lebih besar dari subtotal'
        }
        discountAmount = discountValue
        discountDescription = formatCurrency(discountValue)
      }

      const total = subtotal - discountAmount
      const tax = total * 0.1 // PPN 10%
      const grandTotal = total + tax

      return `📝 Kalkulasi:

Subtotal: ${formatCurrency(subtotal)}
Diskon (${discountDescription}): -${formatCurrency(discountAmount)}
─────────────────
Setelah Diskon: ${formatCurrency(total)}
PPN 10%: +${formatCurrency(tax)}
─────────────────
TOTAL: ${formatCurrency(grandTotal)}

💡 Customer hemat ${formatCurrency(discountAmount)} dengan diskon ini!`
    } catch (error) {
      console.error('Calculate discount tool error:', error)
      return 'Terjadi kesalahan saat menghitung diskon.'
    }
  },
  {
    name: 'calculate_discount',
    description: 'Hitung total belanja dengan diskon. Bisa diskon persen atau nominal.',
    schema: z.object({
      subtotal: z.number().describe('Total belanja sebelum diskon (dalam Rupiah)'),
      discountType: z.enum(['percent', 'nominal']).describe('Tipe diskon: percent atau nominal'),
      discountValue: z.number().describe('Nilai diskon (angka persen atau nominal Rupiah)')
    })
  }
)

// ============================================
// TOOL 4: GET SALES SUMMARY
// ============================================
const getSalesSummaryTool = tool(
  async ({ period }) => {
    try {
      const now = new Date()
      let startDate: Date
      let periodLabel: string

      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          periodLabel = 'Hari ini'
          break
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
          const endYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          periodLabel = 'Kemarin'

          // Special handling for yesterday
          const yesterdayData = await prisma.transaction.aggregate({
            where: {
              createdAt: { gte: startDate, lt: endYesterday },
              status: 'completed'
            },
            _sum: { total: true, discountAmount: true },
            _avg: { total: true },
            _count: true
          })

          const yesterdayTopProducts = await getTopProducts(startDate, endYesterday, 5)

          return formatSalesSummary(periodLabel, yesterdayData, yesterdayTopProducts)

        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
          periodLabel = '7 hari terakhir'
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
          periodLabel = '30 hari terakhir'
          break
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          periodLabel = 'Hari ini'
      }

      // Get aggregate data
      const salesData = await prisma.transaction.aggregate({
        where: {
          createdAt: { gte: startDate },
          status: 'completed'
        },
        _sum: { total: true, discountAmount: true },
        _avg: { total: true },
        _count: true
      })

      // Get top products
      const topProducts = await getTopProducts(startDate, now, 5)

      return formatSalesSummary(periodLabel, salesData, topProducts)
    } catch (error) {
      console.error('Sales summary tool error:', error)
      return 'Terjadi kesalahan saat mengambil data penjualan.'
    }
  },
  {
    name: 'get_sales_summary',
    description: 'Dapatkan ringkasan penjualan untuk periode tertentu. Termasuk total revenue, jumlah transaksi, dan produk terlaris.',
    schema: z.object({
      period: z.enum(['today', 'yesterday', 'week', 'month']).describe('Periode laporan: today, yesterday, week, atau month')
    })
  }
)

// Helper function untuk get top products
async function getTopProducts(startDate: Date, endDate: Date, limit: number) {
  const topItems = await prisma.transactionItem.groupBy({
    by: ['productId', 'productName'],
    where: {
      transaction: {
        createdAt: { gte: startDate, lte: endDate },
        status: 'completed'
      }
    },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { subtotal: 'desc' } },
    take: limit
  })

  return topItems.map((item, index) => ({
    rank: index + 1,
    name: item.productName,
    quantity: item._sum.quantity || 0,
    revenue: item._sum.subtotal || 0
  }))
}

// Helper function untuk format sales summary
function formatSalesSummary(
  periodLabel: string,
  salesData: any,
  topProducts: any[]
) {
  const totalRevenue = salesData._sum.total || 0
  const totalTransactions = salesData._count || 0
  const avgTransaction = salesData._avg.total || 0
  const totalDiscount = salesData._sum.discountAmount || 0

  let response = `📊 LAPORAN PENJUALAN - ${periodLabel.toUpperCase()}

💰 Total Revenue: ${formatCurrency(totalRevenue)}
🧾 Jumlah Transaksi: ${totalTransactions}
📈 Rata-rata/Transaksi: ${formatCurrency(avgTransaction)}
🏷️ Total Diskon: ${formatCurrency(totalDiscount)}
`

  if (topProducts.length > 0) {
    response += `\\n🏆 TOP ${topProducts.length} PRODUK TERLARIS:\\n`
    topProducts.forEach(p => {
      response += `   ${p.rank}. ${p.name} - ${p.quantity} terjual (${formatCurrency(p.revenue)})\\n`
    })
  }

  // Add insight
  if (totalTransactions > 0) {
    response += `\\n💡 Insight: `
    if (avgTransaction > 50000) {
      response += 'Rata-rata transaksi cukup tinggi. Customer cenderung beli banyak item.'
    } else if (avgTransaction > 30000) {
      response += 'Rata-rata transaksi standar. Coba upselling untuk meningkatkan nilai transaksi.'
    } else {
      response += 'Rata-rata transaksi rendah. Pertimbangkan bundling atau promo untuk meningkatkan basket size.'
    }
  }

  return response
}

// ============================================
// TOOL 5: GET PAYMENT METHODS BREAKDOWN
// ============================================
const getPaymentBreakdownTool = tool(
  async ({ period }) => {
    try {
      const now = new Date()
      let startDate: Date

      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
          break
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      }

      const breakdown = await prisma.transaction.groupBy({
        by: ['paymentMethod'],
        where: {
          createdAt: { gte: startDate },
          status: 'completed'
        },
        _count: true,
        _sum: { total: true }
      })

      if (breakdown.length === 0) {
        return 'Belum ada transaksi di periode ini.'
      }

      const total = breakdown.reduce((sum, item) => sum + (item._sum.total || 0), 0)
      const totalCount = breakdown.reduce((sum, item) => sum + item._count, 0)

      const methodLabels: Record<string, string> = {
        'cash': '💵 Tunai',
        'qris': '📱 QRIS',
        'card': '💳 Kartu',
        'transfer': '🏦 Transfer'
      }

      let response = `💳 BREAKDOWN METODE PEMBAYARAN\\n\\n`

      breakdown
        .sort((a, b) => (b._sum.total || 0) - (a._sum.total || 0))
        .forEach(item => {
          const percentage = ((item._sum.total || 0) / total * 100).toFixed(1)
          const label = methodLabels[item.paymentMethod] || item.paymentMethod
          response += `${label}:\\n`
          response += `  • ${item._count} transaksi (${percentage}%)\\n`
          response += `  • ${formatCurrency(item._sum.total || 0)}\\n\\n`
        })

      response += `📊 Total: ${totalCount} transaksi = ${formatCurrency(total)}`

      return response
    } catch (error) {
      console.error('Payment breakdown tool error:', error)
      return 'Terjadi kesalahan saat mengambil data pembayaran.'
    }
  },
  {
    name: 'get_payment_breakdown',
    description: 'Lihat breakdown transaksi berdasarkan metode pembayaran (cash, QRIS, kartu, transfer).',
    schema: z.object({
      period: z.enum(['today', 'week', 'month']).describe('Periode: today, week, atau month')
    })
  }
)

// ============================================
// EXPORT ALL TOOLS
// ============================================
export const allPosTools = [
  searchProductsTool,
  checkStockTool,
  calculateDiscountTool,
  getSalesSummaryTool,
  getPaymentBreakdownTool
]

// Export individual tools for specific use cases
export {
  searchProductsTool,
  checkStockTool,
  calculateDiscountTool,
  getSalesSummaryTool,
  getPaymentBreakdownTool
}