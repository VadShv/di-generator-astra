import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

const log = createLogger('projects')

// GET — List all projects, optionally filtered by isActive, ordered by name
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const isActiveParam = searchParams.get('isActive')

    const where = isActiveParam !== null
      ? { isActive: isActiveParam === 'true' }
      : {}

    const projects = await db.project.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { positions: true }
        }
      }
    })

    return NextResponse.json(projects)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error fetching projects:', { error })
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

// POST — Create a new project
export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { name, code, description, isActive } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Check uniqueness of name
    const existing = await db.project.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json(
        { error: 'A project with this name already exists' },
        { status: 409 }
      )
    }

    const project = await db.project.create({
      data: {
        name,
        code: code || null,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        _count: {
          select: { positions: true }
        }
      }
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error creating project:', { error })
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}

// PUT — Update a project
export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { id, name, code, description, isActive } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Check unique name constraint if name is being changed
    if (name && name !== existing.name) {
      const nameTaken = await db.project.findUnique({ where: { name } })
      if (nameTaken) {
        return NextResponse.json(
          { error: 'A project with this name already exists' },
          { status: 409 }
        )
      }
    }

    const project = await db.project.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code: code || null }),
        ...(description !== undefined && { description: description || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        _count: {
          select: { positions: true }
        }
      }
    })

    return NextResponse.json(project)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error updating project:', { error })
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    )
  }
}

// DELETE — Delete a project by id, checking for referenced positions
export async function DELETE(request: NextRequest) {
  try {
    await requireRole('admin')
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const existing = await db.project.findUnique({
      where: { id },
      include: { positions: true }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (existing.positions.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a project that has positions referencing it' },
        { status: 400 }
      )
    }

    await db.project.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error deleting project:', { error })
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}
