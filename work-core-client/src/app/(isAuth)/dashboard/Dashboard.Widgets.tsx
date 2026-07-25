'use client'

import React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// Палітра з помаранчевим акцентом; кольори поверхонь — токени теми,
// тож панель темна в темній темі та світла у світлій
export const ACCENT = '#f97316'
export const ACCENT_SOFT = '#fb923c'

const tooltipStyle = {
  borderRadius: '10px',
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--foreground)',
  fontSize: '12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
}

export const panel =
  'rounded-2xl border border-[var(--border)] bg-surface p-5'

/** KPI-картка зі спарклайном і дельтою */
export function StatCard({
  label,
  value,
  sub,
  delta,
  spark,
  color = ACCENT,
}: {
  label: string
  value: string | number
  sub?: string
  delta?: { value: string; positive: boolean }
  spark: { v: number }[]
  color?: string
}) {
  const gid = `spark-${label.replace(/\s/g, '')}-${color.replace('#', '')}`
  return (
    <div className={panel + ' flex flex-col justify-between min-h-[130px]'}>
      <div className='flex items-start justify-between gap-2'>
        <span className='text-[13px] text-muted font-medium'>{label}</span>
        {delta && (
          <span
            className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
              delta.positive
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                : 'text-orange-600 dark:text-orange-400 bg-orange-500/10'
            }`}
          >
            {delta.positive ? '↑' : '↓'} {delta.value}
          </span>
        )}
      </div>
      <div className='flex items-end justify-between gap-2 mt-1'>
        <div>
          <div className='text-[26px] leading-tight font-bold text-foreground'>
            {value}
          </div>
          {sub && <div className='text-[11px] text-muted/80 mt-1'>{sub}</div>}
        </div>
        <div className='w-[90px] h-[38px] shrink-0'>
          <ResponsiveContainer width='100%' height='100%'>
            <AreaChart data={spark} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={gid} x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor={color} stopOpacity={0.35} />
                  <stop offset='100%' stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type='monotone'
                dataKey='v'
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gid})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

/** Великий area-чарт (тренд годин по днях) */
export function AreaTrendCard({
  title,
  data,
  extra,
}: {
  title: string
  data: { label: string; hours: number }[]
  extra?: React.ReactNode
}) {
  return (
    <div className={panel + ' flex flex-col'}>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-foreground font-semibold'>{title}</h3>
        {extra}
      </div>
      <div className='h-[240px] w-full'>
        <ResponsiveContainer width='100%' height='100%'>
          <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id='areaHours' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0%' stopColor={ACCENT} stopOpacity={0.28} />
                <stop offset='100%' stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey='label'
              stroke='var(--muted)'
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval='preserveStartEnd'
              minTickGap={24}
            />
            <YAxis
              stroke='var(--muted)'
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: 'var(--border)' }}
            />
            <Area
              type='monotone'
              dataKey='hours'
              name='Години'
              stroke={ACCENT}
              strokeWidth={2.5}
              fill='url(#areaHours)'
              dot={false}
              activeDot={{ r: 4, fill: ACCENT, stroke: 'var(--surface)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Donut розподілу за статусами */
export function DonutCard({
  title,
  total,
  totalLabel,
  data,
}: {
  title: string
  total: number
  totalLabel: string
  data: { name: string; value: number; color: string }[]
}) {
  const hasData = data.some((d) => d.value > 0)
  return (
    <div className={panel + ' flex flex-col'}>
      <h3 className='text-foreground font-semibold mb-4'>{title}</h3>
      <div className='flex items-center gap-4 flex-1'>
        <div className='relative w-[150px] h-[150px] shrink-0'>
          {hasData ? (
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie
                  data={data}
                  dataKey='value'
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={3}
                  stroke='none'
                  startAngle={90}
                  endAngle={-270}
                >
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className='w-full h-full rounded-full border-[16px] border-[var(--surface-3)]' />
          )}
          <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
            <span className='text-2xl font-bold text-foreground'>{total}</span>
            <span className='text-[10px] text-muted uppercase tracking-wide'>
              {totalLabel}
            </span>
          </div>
        </div>
        <div className='flex flex-col gap-2.5 flex-1'>
          {data.map((d) => (
            <div key={d.name} className='flex items-center gap-2'>
              <span
                className='h-2.5 w-2.5 rounded-full shrink-0'
                style={{ backgroundColor: d.color }}
              />
              <span className='text-[13px] text-foreground/75 flex-1'>{d.name}</span>
              <span className='text-[13px] font-semibold text-foreground'>
                {d.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Невеликий bar-чарт (напр. години по відділеннях) */
export function MiniBarCard({
  title,
  data,
}: {
  title: string
  data: { name: string; value: number }[]
}) {
  return (
    <div className={panel + ' flex flex-col'}>
      <h3 className='text-foreground font-semibold mb-4'>{title}</h3>
      <div className='h-[180px] w-full'>
        {data.length > 0 ? (
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis
                dataKey='name'
                stroke='var(--muted)'
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke='var(--muted)'
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={34}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: 'var(--surface-2)' }}
              />
              <Bar dataKey='value' radius={[4, 4, 0, 0]} fill={ACCENT} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className='h-full flex items-center justify-center text-muted text-sm'>
            Немає даних
          </div>
        )}
      </div>
    </div>
  )
}
