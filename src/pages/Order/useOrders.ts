import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export interface OrderItem {
  id: number
  created_at?: string
  order_id?: number
  pro_id?: number
  qty?: number
  price?: number
}

export interface Order {
  id: number
  created_at?: string
  user_id?: number
  pm_type?: string
  sale_price?: number
  address?: any
  readme?: string
  total_qty?: number
  delivery_confirmed?: string
  promotion?: number
  payee?: string
  items?: OrderItem[]
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const perPage = 10
  const [totalCount, setTotalCount] = useState(0)

  const fetchOrders = useCallback(async (pageNum: number = 1) => {
    try {
      setLoading(true)
      setError(null)
      // fetch paginated orders with their items
      const from = (pageNum - 1) * perPage
      const to = pageNum * perPage - 1

      const { data, error: err, count } = await supabase
        .from('Order')
        .select(`*, OrderItem(*, pro_id(*, cate_id(*))), user_id(*)`, { count: 'exact' })
        .order('id', { ascending: false })
        .range(from, to)

      if (err) throw err
      setOrders((data as any) || [])
      if (typeof count === 'number') {
        setTotalCount(count)
      }
      setPage(pageNum)
    //   console.log('Fetched orders:', data)
    } catch (e) {
      setError((e as Error).message || 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders(1)
  }, [fetchOrders])

  return { orders, loading, error, fetchOrders, page, perPage, totalCount }
}
