import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const companies = await db.company.findMany({
      include: {
        _count: {
          select: { departments: true }
        }
      },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(companies)
  } catch (error) {
    console.error('Error fetching companies:', error)
    return NextResponse.json({ error: 'Ошибка при получении компаний' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
   const { name, shortName, code, type, director, description } = body
    const { inn, ogrn, kpp, legalAddress, actualAddress } = body

   if (!name || !code) {
      return NextResponse.json({ error: 'Название и код обязательны' }, { status: 400 })
    }

    const existing = await db.company.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: 'Компания с таким кодом уже существует' }, { status: 409 })
    }

    const company = await db.company.create({
      data: {
       name,
       shortName: shortName || null,
       code,
       type: type || null,
       director: director || null,
       description: description || null,
        inn: inn || null,
        ogrn: ogrn || null,
        kpp: kpp || null,
        legalAddress: legalAddress || null,
        actualAddress: actualAddress || null,
     },
     include: {
       _count: {
         select: { departments: true }
       }
     }
   })

   return NextResponse.json(company, { status: 201 })
  } catch (error) {
    console.error('Error creating company:', error)
    return NextResponse.json({ error: 'Ошибка при создании компании' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
   const { id, name, shortName, code, type, director, description } = body
    const { inn, ogrn, kpp, legalAddress, actualAddress } = body

   if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const existing = await db.company.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Компания не найдена' }, { status: 404 })
    }

    // Check unique code if changing
    if (code && code !== existing.code) {
      const codeTaken = await db.company.findUnique({ where: { code } })
      if (codeTaken) {
        return NextResponse.json({ error: 'Компания с таким кодом уже существует' }, { status: 409 })
      }
    }

    const company = await db.company.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(shortName !== undefined && { shortName: shortName || null }),
        ...(code !== undefined && { code }),
       ...(type !== undefined && { type: type || null }),
       ...(director !== undefined && { director: director || null }),
       ...(description !== undefined && { description: description || null }),
        ...(inn !== undefined && { inn: inn || null }),
        ...(ogrn !== undefined && { ogrn: ogrn || null }),
        ...(kpp !== undefined && { kpp: kpp || null }),
        ...(legalAddress !== undefined && { legalAddress: legalAddress || null }),
        ...(actualAddress !== undefined && { actualAddress: actualAddress || null }),
     },
     include: {
       _count: {
         select: { departments: true }
       }
     }
   })

   return NextResponse.json(company)
  } catch (error) {
    console.error('Error updating company:', error)
    return NextResponse.json({ error: 'Ошибка при обновлении компании' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const existing = await db.company.findUnique({
      where: { id },
      include: { departments: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Компания не найдена' }, { status: 404 })
    }

    if (existing.departments.length > 0) {
      return NextResponse.json({ error: 'Невозможно удалить компанию с подразделениями' }, { status: 400 })
    }

    await db.company.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting company:', error)
    return NextResponse.json({ error: 'Ошибка при удалении компании' }, { status: 500 })
  }
}
