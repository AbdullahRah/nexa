import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 120,
  height: 120,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#f5f5f5',
          fontSize: 80,
          fontWeight: 700,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          letterSpacing: '-0.05em',
        }}
      >
        N
      </div>
    ),
    { ...size }
  )
}
