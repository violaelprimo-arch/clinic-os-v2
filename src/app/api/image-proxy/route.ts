import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') || req.nextUrl.searchParams.get('image')
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  try {
    let targetUrl: string
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return new NextResponse('Invalid protocol', { status: 400 })
      }
      targetUrl = parsed.href
    } catch {
      // Relative URL: resolve against request origin
      targetUrl = new URL(url, req.nextUrl.origin).href
    }

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ClinicOS/2.0'
      }
    })
    if (!res.ok) {
      return new NextResponse(`Failed to fetch image: ${res.statusText}`, { status: res.status })
    }

    const contentType = res.headers.get('content-type') || 'image/png'
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400'
      }
    })
  } catch (err: any) {
    return new NextResponse(`Proxy error: ${err?.message || 'unknown'}`, { status: 500 })
  }
}
