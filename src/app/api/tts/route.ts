import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get('text')
  if (!text || !text.trim()) {
    return new NextResponse('Missing text parameter', { status: 400 })
  }

  const cleanText = text.trim().slice(0, 200) // Ensure reasonable sentence length
  const lang = req.nextUrl.searchParams.get('tl') || 'ar'

  try {
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${encodeURIComponent(lang)}&client=tw-ob`

    const upstreamRes = await fetch(googleTtsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.8',
        'Referer': 'https://translate.google.com/'
      }
    })

    if (!upstreamRes.ok) {
      // Secondary fallback with client=gtx
      const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${encodeURIComponent(lang)}&client=gtx`
      const fallbackRes = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.8'
        }
      })

      if (!fallbackRes.ok) {
        return new NextResponse('Failed to fetch audio stream', { status: fallbackRes.status })
      }

      const audioBuffer = await fallbackRes.arrayBuffer()
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    const audioBuffer = await upstreamRes.arrayBuffer()
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (err: any) {
    console.error('TTS API error:', err)
    return new NextResponse(`TTS service error: ${err?.message || 'unknown'}`, { status: 500 })
  }
}
