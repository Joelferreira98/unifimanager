import { Card } from 'antd'
import type { ReactNode } from 'react'

export const GRADIENTS = {
  blue: 'linear-gradient(97deg, #0075ff 0%, #21d4fd 100%)',
  orange: 'linear-gradient(97deg, #ff9a44 0%, #ffb547 100%)',
  green: 'linear-gradient(97deg, #01b574 0%, #20e3b2 100%)',
  purple: 'linear-gradient(97deg, #7551ff 0%, #b18cff 100%)',
  red: 'linear-gradient(97deg, #ee5d50 0%, #ff8a80 100%)',
}

export default function StatCard({
  title,
  value,
  icon,
  gradient = GRADIENTS.blue,
}: {
  title: string
  value: string | number
  icon: ReactNode
  gradient?: string
}) {
  return (
    <Card styles={{ body: { padding: 20 } }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
            {value}
          </div>
        </div>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            flexShrink: 0,
            background: gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 20,
            boxShadow: '0 8px 18px rgba(0,0,0,0.35)',
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  )
}
