import { NextRequest, NextResponse } from 'next/server'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { JsonOutputParser } from '@langchain/core/output_parsers'
import { llmStrict } from '@/lib/ai/langchain'
import { SEARCH_PARSER_PROMPT } from '@/lib/ai/prompts'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// Schema untuk validasi AI output
const SearchCriteriaSchema = z.object({
  searchTerms: z.array(z.string()),
  category: z.string().nullable(),
  priceRange: z.object({
    min: z.number().nullable(),
    max: z.number().nullable()
  }),
  sortBy: z.enum(['price_asc', 'price_desc', 'name', 'stock']).nullable(),
  attributes: z.object({
    isSweet: z.boolean().nullable(),
    isCold: z.boolean().nullable(),
    hasMilk: z.boolean().nullable(),
    isSpicy: z.boolean().nullable()
  }).optional()
})

type SearchCriteria = z.infer<typeof SearchCriteriaSchema>

async function parseQueryWithAI(
  query: string,
  categoryNames: string
): Promise<{ aiParsed: SearchCriteria | null; parseError: string | null }> {
  const prompt = ChatPromptTemplate.fromTemplate(SEARCH_PARSER_PROMPT)
  const parser = new JsonOutputParser()
  const chain = prompt.pipe(llmStrict).pipe(parser)

  try {
    const parsed = await chain.invoke({
      query,
      categories: categoryNames
    })

    const validated = SearchCriteriaSchema.safeParse(parsed)
    if (!validated.success) {
      console.warn('AI output validation failed:', validated.error)
      return {
        aiParsed: null,
        parseError: 'AI parsing validation failed'
      }
    }

    return {
      aiParsed: validated.data,
      parseError: null
    }
  } catch (aiError) {
    console.error('AI parsing error:', aiError)
    return {
      aiParsed: null,
      parseError: 'AI parsing failed'
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query: rawQuery } = await req.json()
    const query = String(rawQuery ?? '')

    // Simple search untuk query sangat pendek (1-2 karakter) untuk respons cepat
    if (query.length < 2 && query.trim().length > 0) {
      const products = await prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { sku: { contains: query, mode: 'insensitive' } }
            ],
            isActive: true,
        },
        include: { category: true },
        take: 20
      })
      return NextResponse.json({
        products,
        aiParsed: null,
        source: 'simple_search'
      })
    }

    // Query yang jelas bukan search intent, seperti sapaan atau ucapan terima kasih
    const nonSearchPatterns = /^(halo|hai|hi|hello|thanks|terima kasih|ok|oke)/i
    if (nonSearchPatterns.test(query)) {
        // Return empty, biarkan chat handler yang handle
        return NextResponse.json({
            products: [],
            aiParsed: null,
            source: 'not_a_search',
            message: 'Query ini sepertinya bukan pencarian produk'
        })
    }

    // Jika query kosong, return semua produk aktif
    if (!query || query.trim().length === 0) {
      const products = await prisma.product.findMany({
        where: { isActive: true, stock: { gt: 0 } },
        include: { category: true },
        orderBy: { name: 'asc' },
        take: 50
      })

      return NextResponse.json({
        products,
        aiParsed: null,
        source: 'all_products'
      })
    }

    // Get categories untuk context
    const categories = await prisma.category.findMany()
    const categoryNames = categories.map(c => c.name).join(', ')

    const [aiResult, fallbackProducts] = await Promise.all([
      parseQueryWithAI(query, categoryNames),
      prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ],
          isActive: true,
          stock: { gt: 0 }
        },
        include: { category: true },
        orderBy: { name: 'asc' },
        take: 10
      })
    ])

    const { aiParsed, parseError } = aiResult

    // Build Prisma query
    const whereClause: any = {
      AND: [
        { isActive: true },
        { stock: { gt: 0 } }
      ]
    }

    if (aiParsed) {
      // Search terms
      if (aiParsed.searchTerms.length > 0) {
        whereClause.AND.push({
          OR: aiParsed.searchTerms.flatMap(term => [
            { name: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } }
          ])
        })
      }

      // Category filter
      if (aiParsed.category) {
        whereClause.AND.push({
          category: { name: { equals: aiParsed.category, mode: 'insensitive' } }
        })
      }

      // Price range
      if (aiParsed.priceRange.min !== null) {
        whereClause.AND.push({ price: { gte: aiParsed.priceRange.min } })
      }
      if (aiParsed.priceRange.max !== null) {
        whereClause.AND.push({ price: { lte: aiParsed.priceRange.max } })
      }

      // Attribute-based search (search in description)
      if (aiParsed.attributes) {
        const attrFilters: any[] = []

        if (aiParsed.attributes.isSweet === true) {
          attrFilters.push({ description: { contains: 'manis', mode: 'insensitive' } })
        } else if (aiParsed.attributes.isSweet === false) {
          // Cari yang pahit atau tidak manis
          attrFilters.push({
            OR: [
              { description: { contains: 'pahit', mode: 'insensitive' } },
              { description: { contains: 'strong', mode: 'insensitive' } },
              { description: { contains: 'tanpa gula', mode: 'insensitive' } }
            ]
          })
        }

        if (aiParsed.attributes.isCold === true) {
          attrFilters.push({
            OR: [
              { description: { contains: 'dingin', mode: 'insensitive' } },
              { description: { contains: 'cold', mode: 'insensitive' } },
              { description: { contains: 'es ', mode: 'insensitive' } },
              { name: { contains: 'es ', mode: 'insensitive' } }
            ]
          })
        }

        if (aiParsed.attributes.hasMilk === false) {
          // Exclude susu - ini tricky, kita cari yang explicitly tanpa susu
          attrFilters.push({
            OR: [
              { description: { contains: 'tanpa susu', mode: 'insensitive' } },
              { description: { contains: 'hitam', mode: 'insensitive' } },
              { name: { contains: 'Americano', mode: 'insensitive' } },
              { name: { contains: 'Espresso', mode: 'insensitive' } }
            ]
          })
        }

        if (attrFilters.length > 0) {
          whereClause.AND.push(...attrFilters)
        }
      }
    } else {
      return NextResponse.json({
        products: fallbackProducts,
        aiParsed: null,
        originalQuery: query,
        parseError,
        resultCount: fallbackProducts.length,
        source: 'fallback_text_search'
      })
    }

    // Determine sort order
    let orderBy: any = { name: 'asc' }
    if (aiParsed?.sortBy) {
      switch (aiParsed.sortBy) {
        case 'price_asc':
          orderBy = { price: 'asc' }
          break
        case 'price_desc':
          orderBy = { price: 'desc' }
          break
        case 'name':
          orderBy = { name: 'asc' }
          break
        case 'stock':
          orderBy = { stock: 'desc' }
          break
      }
    }

    // Execute query
    const products = await prisma.product.findMany({
      where: whereClause,
      include: { category: true },
      orderBy,
      take: 30
    })

    return NextResponse.json({
      products,
      aiParsed,
      originalQuery: query,
      parseError,
      resultCount: products.length
    })

  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed', details: String(error) },
      { status: 500 }
    )
  }
}
