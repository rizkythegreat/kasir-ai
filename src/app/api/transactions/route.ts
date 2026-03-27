import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateInvoiceNumber } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      items,
      subtotal,
      discountAmount = 0,
      discountPercent = 0,
      taxAmount,
      taxPercent,
      total,
      paymentMethod,
      amountPaid,
      changeAmount = 0,
      cashierName = 'Kasir',
      notes
    } = body

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      )
    }

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber()

    // Create transaction with items in a single transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // 1. Create transaction
      const newTransaction = await tx.transaction.create({
        data: {
          invoiceNumber,
          subtotal,
          discountAmount,
          discountPercent,
          taxAmount,
          taxPercent,
          total,
          paymentMethod,
          amountPaid,
          changeAmount,
          status: 'completed',
          cashierName,
          notes,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              productName: item.productName,
              productSku: item.productSku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
              discountAmount: item.discountAmount || 0
            }))
          }
        },
        include: {
          items: true
        }
      })

      // 2. Update stock for each product
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        })
      }

      return newTransaction
    })

    return NextResponse.json({
      success: true,
      transaction
    })

  } catch (error) {
    console.error('Transaction error:', error)
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    )
  }
}

// GET - List transactions
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const transactions = await prisma.transaction.findMany({
      include: {
        items: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    const total = await prisma.transaction.count()

    return NextResponse.json({
      transactions,
      total,
      limit,
      offset
    })

  } catch (error) {
    console.error('Get transactions error:', error)
    return NextResponse.json(
      { error: 'Failed to get transactions' },
      { status: 500 }
    )
  }
}