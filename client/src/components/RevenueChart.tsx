import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface RevenuePoint {
  label: string
  value: number
}

export default function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0075ff" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#21d4fd" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={20}
        />
        <YAxis
          tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={(v) => `R$ ${v}`}
        />
        <Tooltip
          cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
          contentStyle={{
            background: '#111c44',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            color: '#fff',
          }}
          labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
          formatter={(value) => [`R$ ${Number(value ?? 0).toFixed(2)}`, 'Receita']}
        />
        <Area type="monotone" dataKey="value" stroke="#21a9ff" strokeWidth={3} fill="url(#revGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
