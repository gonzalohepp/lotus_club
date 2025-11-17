import { SignJWT } from 'npm:jose'
import QRCode from 'npm:qrcode-svg'

const QR_SECRET = Deno.env.get('QR_SECRET')!
const TTL = Number(Deno.env.get('QR_DEFAULT_TTL_SECONDS') || 86400)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

function b64Svg(svg: string) {
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  const now = Math.floor(Date.now() / 1000)
  const secret = new TextEncoder().encode(QR_SECRET)

  // JWT corto
  const token = await new SignJWT({ typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + TTL)
    .sign(secret)

  // Generar QR en SVG (256x256)
  const svg = new QRCode({
    content: token,
    padding: 0,
    width: 256,
    height: 256,
    join: true,      // paths unidos (SVG compacto)
    ecl: 'M'
  }).svg()

  const dataUrl = b64Svg(svg)
  const expiresAt = new Date((now + TTL) * 1000).toISOString()

  return new Response(JSON.stringify({ qrDataUrl: dataUrl, expiresAt, token }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
})
