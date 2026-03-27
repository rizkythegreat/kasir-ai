import { NextRequest, NextResponse } from 'next/server'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { prisma } from '@/lib/db'
import { ANALYTICS_PROMPT } from '@/lib/ai/prompts'
import { llmAnalytics } from '@/lib/ai/langchain'

export const runtime = 'nodejs'

interface AnalyticsRequest {
  question: string
  dateRange?: 'today' | 'yesterday' | 'week' | 'month' | 'custom'
  startDate?: string
  endDate?: string
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyticsRequest = await req.json()
    const { question, dateRange = 'week' } = body

    if (!question || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Pertanyaan tidak boleh kosong' },
        { status: 400 }
      )
    }

    // ============================================
    // 1. DETERMINE DATE RANGE
    // ============================================
    const now = new Date()
    let startDate: Date
    let endDate = now
    let periodLabel: string

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        periodLabel = 'Hari ini'
        break
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        periodLabel = 'Kemarin'
        break
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        periodLabel = '7 hari terakhir'
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        periodLabel = '30 hari terakhir'
        break
      case 'custom':
        startDate = body.startDate ? new Date(body.startDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        endDate = body.endDate ? new Date(body.endDate) : now
        periodLabel = 'Custom range'
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        periodLabel = '7 hari terakhir'
    }

    // ============================================
    // 2. FETCH COMPREHENSIVE DATA
    // ============================================
    const [
      // Overall stats
      overallStats,

      // Transaction count by day
      dailyTransactions,

      // Top products
      topProducts,

      // Category breakdown
      categoryStats,

      // Payment methods
      paymentStats,

      // Hourly distribution
      hourlyStats,

      // Cashier performance (jika ada)
      cashierStats
    ] = await Promise.all([
      // 1. Overall aggregate
      prisma.transaction.aggregate({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: 'completed'
        },
        _sum: { total: true, discountAmount: true, taxAmount: true },
        _avg: { total: true },
        _count: true,
        _min: { total: true },
        _max: { total: true }
      }),

      // 2. Daily breakdown - using raw query for grouping
      prisma.$queryRaw`
        SELECT
          DATE("createdAt") as "date",
          COUNT(*)::int as "transactions",
          COALESCE(SUM("total"), 0)::float as "revenue"
        FROM "Transaction"
        WHERE "createdAt" >= ${startDate}
          AND "createdAt" <= ${endDate}
          AND "status" = 'completed'
        GROUP BY DATE("createdAt")
        ORDER BY "date" DESC
      ` as Promise<Array<{ date: string; transactions: number; revenue: number }>>,

      // 3. Top products
      prisma.transactionItem.groupBy({
        by: ['productId', 'productName'],
        where: {
          transaction: {
            createdAt: { gte: startDate, lte: endDate },
            status: 'completed'
          }
        },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { subtotal: 'desc' } },
        take: 10
      }),

      // 4. Category stats
      prisma.$queryRaw`
        SELECT
          p."categoryId",
          c."name" as "categoryName",
          COUNT(ti."id")::int as "itemsSold",
          COALESCE(SUM(ti."subtotal"), 0)::float as "revenue"
        FROM "TransactionItem" ti
        JOIN "Product" p ON ti."productId" = p."id"
        JOIN "Category" c ON p."categoryId" = c."id"
        JOIN "Transaction" t ON ti."transactionId" = t."id"
        WHERE t."createdAt" >= ${startDate}
          AND t."createdAt" <= ${endDate}
          AND t."status" = 'completed'
        GROUP BY p."categoryId", c."name"
        ORDER BY "revenue" DESC
      ` as Promise<Array<{ categoryName: string; itemsSold: number; revenue: number }>>,

      // 5. Payment methods
      prisma.transaction.groupBy({
        by: ['paymentMethod'],
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: 'completed'
        },
        _count: true,
        _sum: { total: true }
      }),

      // 6. Hourly distribution
      prisma.$queryRaw`
        SELECT
          LPAD(EXTRACT(HOUR FROM "createdAt")::text, 2, '0') as "hour",
          COUNT(*)::int as "transactions",
          COALESCE(SUM("total"), 0)::float as "revenue"
        FROM "Transaction"
        WHERE "createdAt" >= ${startDate}
          AND "createdAt" <= ${endDate}
          AND "status" = 'completed'
        GROUP BY 1
        ORDER BY 1
      ` as Promise<Array<{ hour: string; transactions: number; revenue: number }>>,

      // 7. Cashier performance
      prisma.transaction.groupBy({
        by: ['cashierName'],
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: 'completed',
          cashierName: { not: null }
        },
        _count: true,
        _sum: { total: true },
        _avg: { total: true }
      })
    ])

    // ============================================
    // 3. FORMAT DATA FOR AI
    // ============================================
    const analyticsData = {
      period: {
        label: periodLabel,
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },

      summary: {
        totalRevenue: overallStats._sum.total || 0,
        totalTransactions: overallStats._count || 0,
        averageTransaction: overallStats._avg.total || 0,
        totalDiscount: overallStats._sum.discountAmount || 0,
        totalTax: overallStats._sum.taxAmount || 0,
        minTransaction: overallStats._min.total || 0,
        maxTransaction: overallStats._max.total || 0
      },

      dailyBreakdown: dailyTransactions,

      topProducts: topProducts.map((p, i) => ({
        rank: i + 1,
        name: p.productName,
        quantitySold: p._sum.quantity || 0,
        revenue: p._sum.subtotal || 0
      })),

      categoryBreakdown: categoryStats,

      paymentMethods: paymentStats.map(pm => ({
        method: pm.paymentMethod,
        transactions: pm._count,
        total: pm._sum.total || 0,
        percentage: overallStats._count > 0
          ? ((pm._count / overallStats._count) * 100).toFixed(1)
          : 0
      })),

      hourlyDistribution: hourlyStats,

      cashierPerformance: cashierStats.map(c => ({
        name: c.cashierName,
        transactions: c._count,
        totalSales: c._sum.total || 0,
        averageTransaction: c._avg.total || 0
      }))
    }

    // ============================================
    // 4. GENERATE AI ANALYSIS
    // ============================================

    const prompt = ChatPromptTemplate.fromTemplate(ANALYTICS_PROMPT)
    const chain = prompt.pipe(llmAnalytics).pipe(new StringOutputParser())

    const analysis = await chain.invoke({
      data: JSON.stringify(analyticsData, null, 2),
      question
    })

    // ============================================
    // 5. RETURN RESPONSE
    // ============================================
    return NextResponse.json({
      analysis,
      data: analyticsData,
      metadata: {
        question,
        dateRange,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Gagal generate analytics', details: String(error) },
      { status: 500 }
    )
  }
}
