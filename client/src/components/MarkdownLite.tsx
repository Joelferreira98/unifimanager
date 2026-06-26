import { Typography } from 'antd'

// Renderizador mínimo do Markdown devolvido pela IA (títulos, negrito, bullets).
export default function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let list: React.ReactNode[] = []

  const renderInline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} style={{ color: '#fff' }}>{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    )

  const flushList = () => {
    if (list.length) {
      blocks.push(<ul key={`ul-${blocks.length}`} style={{ margin: '4px 0 12px', paddingLeft: 20 }}>{list}</ul>)
      list = []
    }
  }

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()
    if (/^#{1,6}\s/.test(line)) {
      flushList()
      const content = line.replace(/^#{1,6}\s/, '')
      blocks.push(
        <Typography.Title key={idx} level={5} style={{ color: '#fff', marginTop: 16, marginBottom: 6 }}>
          {renderInline(content)}
        </Typography.Title>
      )
    } else if (/^[-*]\s/.test(line)) {
      list.push(<li key={idx} style={{ marginBottom: 4 }}>{renderInline(line.replace(/^[-*]\s/, ''))}</li>)
    } else if (line === '') {
      flushList()
    } else {
      flushList()
      blocks.push(<p key={idx} style={{ margin: '0 0 10px' }}>{renderInline(line)}</p>)
    }
  })
  flushList()

  return <div style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>{blocks}</div>
}
