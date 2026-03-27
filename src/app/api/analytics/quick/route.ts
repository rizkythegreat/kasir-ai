import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    const [todayStats, yesterdayStats] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          createdAt: { gte: todayStart },
          status: 'completed'
        },
        _sum: { total: true },
        _count: true
      }),
      prisma.transaction.aggregate({
        where: {
          createdAt: { gte: yesterdayStart, lt: todayStart },
          status: 'completed'
        },
        _sum: { total: true },
        _count: true
      })
    ])

    const todayRevenue = todayStats._sum.total || 0
    const yesterdayRevenue = yesterdayStats._sum.total || 0

    let trend: 'up' | 'down' | 'neutral' = 'neutral'
    let trendPercent = 0

    if (yesterdayRevenue > 0) {
      const diff = todayRevenue - yesterdayRevenue
      trendPercent = Math.abs(Math.round((diff / yesterdayRevenue) * 100))

      if (diff > 0) trend = 'up'
      else if (diff < 0) trend = 'down'
    }

    return NextResponse.json({
      todayRevenue,
      todayTransactions: todayStats._count,
      yesterdayRevenue,
      trend,
      trendPercent
    })
  } catch (error) {
    console.error('Quick stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}