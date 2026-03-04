import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface SalesMetric {
    date: string
    count: number
    total: number
}

export default function SalesMetrics() {
    const [todaySales, setTodaySales] = useState(0)
    const [todayCount, setTodayCount] = useState(0)
    const [monthSales, setMonthSales] = useState(0)
    const [monthCount, setMonthCount] = useState(0)
    const [totalSales, setTotalSales] = useState(0) // all-time total
    const [totalCount, setTotalCount] = useState(0) // all-time order count
    const [dailyMetrics, setDailyMetrics] = useState<SalesMetric[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchSalesMetrics = async () => {
            try {
                setLoading(true)
                setError(null)

                const now = new Date()
                // compute dates using the local timezone so "today" matches what the user expects
                const pad = (n: number) => n.toString().padStart(2, '0')
                const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
                const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
                const monthEnd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}`
                // monthStart/monthEnd now represent the full current month in local timezone

                // Fetch all orders for metrics
                const { data: allSales, error: fetchErr } = await supabase
                    .from('Order')
                    .select('*')
                    .gte('created_at', monthStart)
                    .lte('created_at', monthEnd)

                if (fetchErr) throw fetchErr

                let tCount = 0
                let tTotal = 0
                let mCount = 0
                let mTotal = 0
                const dailyMap: Record<string, { count: number; total: number }> = {}

                if (allSales) {
                    allSales.forEach((item: any) => {
                        const itemTotal = item.sale_price || 0
                        // normalize the order timestamp to a local date string (YYYY-MM-DD)
                        const created = item.created_at ? new Date(item.created_at) : null
                        const dateStr = created
                            ? `${created.getFullYear()}-${pad(created.getMonth() + 1)}-${pad(created.getDate())}`
                            : ''

                        // Month totals
                        mCount++
                        mTotal += itemTotal

                        // Daily breakdown
                        if (!dailyMap[dateStr]) {
                            dailyMap[dateStr] = { count: 0, total: 0 }
                        }
                        dailyMap[dateStr].count++
                        dailyMap[dateStr].total += itemTotal

                        // Today check
                        if (dateStr === today) {
                            tCount++
                            tTotal += itemTotal
                        }
                    })
                }

                setTodayCount(tCount)
                setTodaySales(tTotal)
                setMonthCount(mCount)
                setMonthSales(mTotal)

                // fetch all-time sales total and count
                const { data: allOrders } = await supabase
                    .from('Order')
                    .select('sale_price')
                let grandTotal = 0
                const countAll = allOrders?.length || 0
                if (allOrders) {
                    allOrders.forEach((o: any) => {
                        grandTotal += o.sale_price || 0
                    })
                }
                setTotalSales(grandTotal)
                setTotalCount(countAll)

                // Build last 7 days
                const days: SalesMetric[] = []
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(now)
                    d.setDate(d.getDate() - i)
                    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
                    days.push({
                        date: dateStr,
                        count: dailyMap[dateStr]?.count || 0,
                        total: dailyMap[dateStr]?.total || 0,
                    })
                }
                setDailyMetrics(days)
            } catch (e) {
                setError((e as Error).message || 'Failed to load sales metrics')
                console.error('Sales metrics error:', e)
            } finally {
                setLoading(false)
            }
        }

        fetchSalesMetrics()
    }, [])

    if (error) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <p className="text-sm text-red-600">{error}</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Key metrics cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-xl border col-span-1 border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">ຍອດຂາຍວັນນີ້</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {loading ? '...' : todaySales.toLocaleString('en-US')} ₭
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{todayCount} ລາຍການ</p>
                </div>

                <div className="rounded-xl border col-span-1 border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">ຍອດຂາຍເດືອນນີ້</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {loading ? '...' : monthSales.toLocaleString('en-US')} ₭
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{monthCount} ລາຍການ</p>
                </div>
                <div className="rounded-xl border col-span-2 lg:col-span-1 border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">ຍອດຂາຍທັງໝົດ</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {loading ? '...' : totalSales.toLocaleString('en-US')} ₭
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{loading ? '...' : totalCount} ລາຍການ</p>
                </div>
            </div>

            {/* Daily breakdown */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">ຍອດຂາຍ 7 ວັນລ່າສຸດ</h3>
                <div className="space-y-2">
                    {loading ? (
                        <div className="space-y-2">
                            {Array(7).fill(null).map((_, i) => (
                                <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                            ))}
                        </div>
                    ) : (
                        dailyMetrics.map((metric) => {
                            const maxTotal = Math.max(...dailyMetrics.map(m => m.total), 1)
                            const barWidth = (metric.total / maxTotal) * 100
                            const dateObj = new Date(metric.date + 'T00:00:00')
                            const dateLabel = dateObj.toLocaleDateString('lo-LA', { month: 'short', day: 'numeric' })

                            return (
                                <div key={metric.date}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-gray-700 dark:text-gray-300">{dateLabel}</span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {metric.total.toLocaleString('en-US')} ₭
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-blue-600 h-full rounded-full transition-all"
                                            style={{ width: `${barWidth}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">{metric.count} ລາຍການ</p>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
