'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { VITAL_LABELS } from '@/lib/utils'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface VitalRecord {
  measured_at: string
  type: string
  value: number
}

interface VitalChartProps {
  data: VitalRecord[]
  types: string[]
}

export function VitalChart({ data, types }: VitalChartProps) {
  if (data.length === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-gray-400">データがありません</div>
  }

  const dateMap: Record<string, Record<string, number>> = {}
  data.forEach(record => {
    const date = format(new Date(record.measured_at), 'MM/dd', { locale: ja })
    if (!dateMap[date]) dateMap[date] = {}
    dateMap[date][record.type] = record.value
  })

  const chartData = Object.entries(dateMap).map(([date, values]) => ({ date, ...values }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        {types.length > 1 && <Legend />}
        {types.map(type => (
          <Line
            key={type}
            type="monotone"
            dataKey={type}
            name={VITAL_LABELS[type]?.label ?? type}
            stroke={VITAL_LABELS[type]?.color ?? '#666'}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
