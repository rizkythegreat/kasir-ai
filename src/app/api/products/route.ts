import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const activeOnly = searchParams.get('active') !== 'false'

    const products = await prisma.product.findMany({
      where: {
        isActive: activeOnly,
        ...(category && {
          category: { name: { equals: category, mode: 'insensitive' } }
        })
      },
      include: {
        category: true
      },
      orderBy: [
        { category: { name: 'asc' } },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({ products })

  } catch (error) {
    console.error('Get products error:', error)
    return NextResponse.json(
      { error: 'Failed to get products' },
      { status: 500 }
    )
  }
}