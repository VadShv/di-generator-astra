import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * GET /api/docs/assets/[file] — локальная раздача Swagger UI assets.
 * Заменяет CDN (unpkg.com) — устраняет зависимость от внешнего источника
 * и риск подмены скриптов (SRI не требуется, т.к. файлы хостятся локально).
 *
 * Поддерживаемые файлы: swagger-ui.css, swagger-ui-bundle.js.
 */
const ASSET_MAP: Record<string, { path: string; contentType: string }> = {
  'swagger-ui.css': {
    path: 'swagger-ui-dist/index.css',
    contentType: 'text/css; charset=utf-8',
  },
  'swagger-ui-bundle.js': {
    path: 'swagger-ui-dist/index.js',
    contentType: 'application/javascript; charset=utf-8',
  },
  'swagger-ui-standalone-preset.js': {
    path: 'swagger-ui-dist/swagger-ui-standalone-preset.js',
    contentType: 'application/javascript; charset=utf-8',
  },
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params
  const asset = ASSET_MAP[file]

  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  try {
    const filePath = resolve(process.cwd(), 'node_modules', asset.path)
    const content = readFileSync(filePath)
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': asset.contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Asset read error' }, { status: 500 })
  }
}
