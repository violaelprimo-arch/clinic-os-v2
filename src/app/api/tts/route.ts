import { NextRequest, NextResponse } from 'next/server'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const CHROMIUM_FULL_VERSION = '143.0.3650.75'
const SEC_MS_GEC_VERSION = '1-' + CHROMIUM_FULL_VERSION
const WINDOWS_FILE_TIME_EPOCH = BigInt('11644473600')

async function generateSecMsGecToken(): Promise<string> {
  const ticks = BigInt(Math.floor((Date.now() / 1000) + Number(WINDOWS_FILE_TIME_EPOCH))) * BigInt('10000000')
  const roundedTicks = ticks - (ticks % BigInt('3000000000'))
  const strToHash = `${roundedTicks}${TRUSTED_CLIENT_TOKEN}`
  const data = new TextEncoder().encode(strToHash)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

// Synthesize authentic natural neural voices via Microsoft Edge Speech Services
function synthesizeEdgeTTS(text: string, voice: string): Promise<ArrayBuffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const token = await generateSecMsGecToken()
      const wsUrl = `wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${token}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`

      const WS = (globalThis as any).WebSocket
      if (!WS) {
        return reject(new Error('WebSocket not available'))
      }

      const ws = new WS(wsUrl, {
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache',
          'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'
        }
      })

      const audioChunks: Uint8Array[] = []
      ws.binaryType = 'arraybuffer'

      const timeout = setTimeout(() => {
        try { ws.close() } catch (e) {}
        reject(new Error('Edge TTS timeout'))
      }, 5000)

      ws.onopen = () => {
        const configMsg = 'Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n' + JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
              }
            }
          }
        })
        ws.send(configMsg)

        const reqId = crypto.randomUUID().replace(/-/g, '')
        const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-EG"><voice name="${voice}"><prosody rate="0%" pitch="0%">${text}</prosody></voice></speak>`
        const ssmlMsg = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`
        ws.send(ssmlMsg)
      }

      ws.onmessage = (event: any) => {
        if (typeof event.data === 'string') {
          if (event.data.includes('Path:turn.end')) {
            clearTimeout(timeout)
            try { ws.close() } catch (e) {}
            const totalLength = audioChunks.reduce((acc, c) => acc + c.byteLength, 0)
            const fullBuf = new Uint8Array(totalLength)
            let offset = 0
            for (const c of audioChunks) {
              fullBuf.set(c, offset)
              offset += c.byteLength
            }
            resolve(fullBuf.buffer)
          }
        } else if (event.data instanceof ArrayBuffer) {
          const u8 = new Uint8Array(event.data)
          // Search for Path:audio\r\n separator
          const sepBytes = [80, 97, 116, 104, 58, 97, 117, 100, 105, 111, 13, 10]
          let sepIdx = -1
          for (let i = 0; i <= u8.length - sepBytes.length; i++) {
            let match = true
            for (let j = 0; j < sepBytes.length; j++) {
              if (u8[i + j] !== sepBytes[j]) {
                match = false
                break
              }
            }
            if (match) {
              sepIdx = i
              break
            }
          }
          if (sepIdx !== -1) {
            const audioBytes = u8.subarray(sepIdx + sepBytes.length)
            if (audioBytes.length > 0) {
              audioChunks.push(audioBytes)
            }
          }
        }
      }

      ws.onerror = (e: any) => {
        clearTimeout(timeout)
        reject(e)
      }
    } catch (err) {
      reject(err)
    }
  })
}

export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get('text')
  if (!text || !text.trim()) {
    return new NextResponse('Missing text parameter', { status: 400 })
  }

  const cleanText = text.trim().slice(0, 250)
  const gender = req.nextUrl.searchParams.get('gender') || 'female'
  const lang = req.nextUrl.searchParams.get('tl') || 'ar'

  // Primary: Authentic Neural Edge Voices
  // Male: ar-EG-ShakirNeural (Natural Egyptian male broadcaster)
  // Female: ar-EG-SalmaNeural (Sweet natural Egyptian female voice)
  const edgeVoice = gender === 'male' ? 'ar-EG-ShakirNeural' : 'ar-EG-SalmaNeural'

  try {
    const edgeAudioBuffer = await synthesizeEdgeTTS(cleanText, edgeVoice)
    if (edgeAudioBuffer && edgeAudioBuffer.byteLength > 1000) {
      return new NextResponse(edgeAudioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
          'Access-Control-Allow-Origin': '*',
          'X-TTS-Engine': 'edge-neural'
        }
      })
    }
  } catch (edgeErr) {
    console.warn('Edge TTS synthesis failed, falling back to Google TTS:', edgeErr)
  }

  // Secondary Fallback: Google Translate TTS stream
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
