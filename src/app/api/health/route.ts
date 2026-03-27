import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const productCount = await prisma.product.count()
    const categoryCount = await prisma.category.count()
    const transactionCount = await prisma.transaction.count()

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      counts: {
        products: productCount,
        categories: categoryCount,
        transactions: transactionCount
      }
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Database connection failed' },
      { status: 500 }
    )
  }
}