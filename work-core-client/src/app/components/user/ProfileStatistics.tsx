'use client'

import React from 'react'
import {
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts'

export interface StatsData {
  totalHours: number
  totalShifts: number
  overtimeHours: number
  dailyHours: { date: string; hours: number }[]
  tagDistribution: { name: string; value: number }[]
}

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

export const StatsKpiCards = ({
  totalHours,
  totalShifts,
  overtimeHours,
}: {
  totalHours: number
  totalShifts: number
  overtimeHours: number
}) => {
  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-5 w-full h-full'>
      <div className='flex flex-col justify-center h-full w-full rounded-2xl shadow-xs border-1 border-secondary/10 p-6 bg-white'>
        <p className='text-sm text-secondary font-medium'>
          Відпрацьовано годин
        </p>
        <p className='text-3xl font-bold text-black mt-2'>{totalHours}</p>
      </div>
      <div className='flex flex-col justify-center h-full w-full rounded-2xl shadow-xs border-1 border-secondary/10 p-6 bg-white'>
        <p className='text-sm text-secondary font-medium'>Кількість змін</p>
        <p className='text-3xl font-bold text-black mt-2'>{totalShifts}</p>
      </div>
      <div className='flex flex-col justify-center h-full w-full rounded-2xl shadow-xs border-1 border-secondary/10 p-6 bg-white'>
        <p className='text-sm text-secondary font-medium'>Овертайм (год)</p>
        <p className='text-3xl font-bold text-black mt-2'>{overtimeHours}</p>
      </div>
    </div>
  )
}

export const MonthlyHoursChart = ({
  data,
}: {
  data: { date: string; hours: number }[]
}) => {
  return (
    <div className='flex flex-col h-full w-full rounded-2xl shadow-xs border-1 border-secondary/10 p-6 bg-white'>
      <h4 className='font-semibold text-black text-xl mb-6'>
        Робочі години за місяць
      </h4>
      <div className='flex-1 w-full min-h-[250px]'>
        <ResponsiveContainer width='100%' height='100%'>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id='colorHours' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='#3B82F6' stopOpacity={0.3} />
                <stop offset='95%' stopColor='#3B82F6' stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey='date'
              stroke='#9CA3AF'
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke='#9CA3AF'
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <RechartsTooltip
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid rgba(0,0,0,0.05)',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                backgroundColor: '#fff',
              }}
              itemStyle={{ color: '#000' }}
            />
            <Area
              type='monotone'
              dataKey='hours'
              stroke='#3B82F6'
              strokeWidth={3}
              fillOpacity={1}
              fill='url(#colorHours)'
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export const RolesDistributionChart = ({
  data,
}: {
  data: { name: string; value: number }[]
}) => {
  return (
    <div className='flex flex-col h-full w-full rounded-2xl shadow-xs border-1 border-secondary/10 p-6 bg-white'>
      <h4 className='font-semibold text-black text-xl mb-6'>
        Розподіл за ролями
      </h4>
      <div className='flex-1 w-full flex items-center justify-center min-h-[250px]'>
        {data && data.length > 0 ? (
          <ResponsiveContainer width='100%' height='100%'>
            <PieChart>
              <Pie
                data={data}
                innerRadius={65}
                outerRadius={90}
                paddingAngle={5}
                dataKey='value'
                stroke='none'
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.05)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Legend
                verticalAlign='bottom'
                height={36}
                iconType='circle'
                wrapperStyle={{ fontSize: '14px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className='text-secondary text-sm'>Немає даних за тегами</p>
        )}
      </div>
    </div>
  )
}
