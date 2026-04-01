import { useEffect, useState } from 'react'
import { useOrders } from './useOrders'
import { supabase } from '../../lib/supabase'
import Badge from '../../components/ui/badge/Badge'
import Button from '../../components/ui/button/Button'
import { useNavigate } from 'react-router'
import { InvoiceContent } from './showInvoice'
import { promptPaymentMethod } from './paymentActions'
import { toggleDelivery } from './deliveryActions'
import { deleteOrder } from './deleteActions'
import { useModal } from '../../hooks/useModal'
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "../../components/ui/table";

export default function Index_Order() {


    const navigate = useNavigate()
    const { orders, loading, error, fetchOrders, page, perPage, totalCount } = useOrders() as any
    const { isOpen, openModal, closeModal } = useModal()
    const [selectedOrder, setSelectedOrder] = useState<any>(null)
    const [totalAllOrdersRevenue, setTotalAllOrdersRevenue] = useState(0)
    const [loadingTotal, setLoadingTotal] = useState(true)
    const [totalAllPayeeTotals, setTotalAllPayeeTotals] = useState<Record<string, number>>({})

    // Close modal on ESC key press
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                closeModal()
            }
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [isOpen, closeModal])

    // Fetch grand total revenue on mount
    useEffect(() => {
        const fetchGrandTotal = async () => {
            try {
                setLoadingTotal(true)
                const { data: allOrders } = await supabase
                    .from('Order')
                    .select('sale_price, payee, phase_id!inner(status)')
                    .eq('phase_id.status', 'active')
                let total = 0
                const payeeMap: Record<string, number> = {}
                if (allOrders) {
                    allOrders.forEach((o: any) => {
                        total += o.sale_price || 0
                        const name = o.payee || 'N/A'
                        payeeMap[name] = (payeeMap[name] || 0) + (o.sale_price || 0)
                    })
                }
                setTotalAllOrdersRevenue(total)
                setTotalAllPayeeTotals(payeeMap)
            } catch (err) {
                console.error('Failed to fetch grand total:', err)
            } finally {
                setLoadingTotal(false)
            }
        }
        fetchGrandTotal()
    }, [])

    useEffect(() => {
        fetchOrders()
    }, [fetchOrders])

    if (error) return <div className="p-4 text-red-600">{error}</div>


    const handlePaymentMethod = (orderId: number) => {
        promptPaymentMethod(orderId, fetchOrders)
    }

    // aggregates for visible orders on the page
    const ordersCount = orders?.length || 0
    const ordersTotalQty = orders.reduce((s: number, o: any) => s + (o.total_qty || 0), 0)
    const ordersTotalRevenue = orders.reduce((s: number, o: any) => s + (o.sale_price || 0), 0)
    // totals grouped by payee for visible orders
    const payeeTotalsMap: Record<string, number> = {}
    orders.forEach((o: any) => {
        const name = o.payee || 'N/A'
        payeeTotalsMap[name] = (payeeTotalsMap[name] || 0) + (o.sale_price || 0)
    })


    const onExport = async () => {
        if (!orders || orders.length === 0) {
            alert('No orders to export')
            return
        }

        // Prepare rows
        const headers = ['#ເຟສ', 'ເວລາ', 'ການຈ່າຍ', 'ຈຳນວນລວມ', 'ເງີນລວມ', 'ຜູ້ຮັບເງີນ', 'ລາຍການ', 'ຜູ້ອອກບີນ', 'ຈັດສົ່ງ']
        const rows = orders.map((o: any) => {
            const items = (o.OrderItem || [])
                .map((it: any) => {
                    const name = it.pro_id?.pro_name || it.pro_id || ''
                    return `${name} x ${it.qty} @ ${it.price?.toLocaleString('en-US')} ₭`
                })
                .join(' | ')

            const addressStr = o.address
                ? `${o.address.name || ''} | ${o.address.phone || ''} | ${o.address.branch || ''} | ${o.address.address || ''}`
                : ''

            return [
                o.phase_id?.phase_name,
                o.created_at ? new Date(o.created_at).toLocaleString() : '',
                o.pm_type || '',
                o.total_qty ?? '',
                o.sale_price != null ? o.sale_price.toLocaleString('en-US') + ' ₭' : '-',
                o.payee ?? '',
                items,
                o.user_id?.fullname || '',
                addressStr,
            ]
        })

        // Try to generate real Excel (.xlsx) using SheetJS if available
        try {
            const XLSX = await import('xlsx')
            const wb = XLSX.utils.book_new()
            const aoa = [headers, ...rows]
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            XLSX.utils.book_append_sheet(wb, ws, 'Orders')
            const ts = new Date().toISOString().replace(/[:.]/g, '-')
            XLSX.writeFile(wb, `ອໍເດີ້ຂາຍ-${ts}.xlsx`)
            return
        } catch (xlsxErr) {
            console.warn('SheetJS not available, falling back to CSV export', xlsxErr)
        }

        // Fallback: CSV download (UTF-8 BOM)
        try {
            const bom = '\uFEFF'
            const titleLine = 'Order'
            const csvLines = [
                titleLine,
                '',
                headers.join(','),
                ...rows.map((r: any[]) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
            ]

            const csv = bom + csvLines.join('\r\n')
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            const ts = new Date().toISOString().replace(/[:.]/g, '-')
            a.href = url
            a.download = `ອໍເດີ້ລາຍການ-${ts}.csv`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('Export failed', err)
            alert('Export failed')
        }
    }


    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 w-full items-center justify-between mb-2">
                <h1 className="text-2xl font-bold text-gray-600 dark:text-gray-200 mb-2 md:mb-0">ລາຍການສັ່ງຊື້</h1>
                <div className="flex flex-wrap items-center md:justify-end align-bottom gap-2">
                    <Button size="sm" className='h-6' variant="outline" onClick={() => navigate('/order/create')}>
                        ເພີ່ມລາຍການ
                    </Button>
                    <Button size="sm" className='h-6' variant="outline" onClick={() => onExport()}>
                        Export Excel
                    </Button>
                    <Button size="sm" className='h-6' variant="outline" onClick={() => fetchOrders(page)}>
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                <div className="max-w-full overflow-x-auto">
                    {loading ? (
                        <Table>
                            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                                {Array(5)
                                    .fill(null)
                                    .map((_, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <Table>
                            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                                <TableRow className={orders.length === 0 ? 'hidden' : ''}>
                                    <TableCell
                                        isHeader
                                        className="sticky left-0 z-20 px-5 w-1 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 dark:border-blue-800"
                                    >
                                        Order#
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ວັນທີ່
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ຜູ້ຮັບ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ລາຍການ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ລວມ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ລາຄາຂາຍ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        Payee
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ຜູ້ເພີມ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ຈັດການ
                                    </TableCell>
                                </TableRow>
                            </TableHeader>

                            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05] ">
                                {orders.map((o: any) => (
                                    <TableRow
                                        key={o.id}
                                        className='hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer'
                                    >
                                        <TableCell onClick={() => { setSelectedOrder(o); openModal() }} className="sticky left-0 z-10 px-5 w-1 text-gray-500 text-theme-sm dark:text-gray-400 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/50 dark:hover:bg-gray-900 dark:border-gray-700">#{o.order || '#'}</TableCell>
                                        <TableCell onClick={() => { setSelectedOrder(o); openModal() }} className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{o.created_at ? new Date(o.created_at).toLocaleString() : ''}</TableCell>
                                        <TableCell onClick={() => { setSelectedOrder(o); openModal() }} className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{o.address.name || ''}</TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            <ul className='h-10 w-75 overflow-auto'>
                                                {o.OrderItem?.map((it: any) => (
                                                    <li key={it.id}>ສີນຄ້າ: {it.pro_id?.pro_name} — ຈຳນວນ: {it.qty} — ເງີນ: {it.price?.toLocaleString('en-US')} ₭</li>
                                                ))}
                                            </ul>
                                        </TableCell>
                                        <TableCell onClick={() => { setSelectedOrder(o); openModal() }} className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{o.total_qty}</TableCell>
                                        <TableCell onClick={() => { setSelectedOrder(o); openModal() }} className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{o.sale_price?.toLocaleString('en-US')} ₭</TableCell>
                                        <TableCell onClick={() => { setSelectedOrder(o); openModal() }} className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{o.payee ? o.payee : 'N/A'}</TableCell>
                                        <TableCell onClick={() => { setSelectedOrder(o); openModal() }} className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">{o.user_id?.fullname ? o.user_id.fullname : 'N/A'}</TableCell>
                                        <TableCell className="pr-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    className="p-0 w-20 flex justify-end"
                                                    onClick={() => handlePaymentMethod(o.id)}
                                                >
                                                    {(o.pm_type === 'ໂອນ' || o.pm_type === 'ຈ່າຍສົດ') ? (
                                                        <Badge variant="light" color="success" size="sm">{o.pm_type}</Badge>
                                                    ) : (
                                                        <Badge variant="light" color="warning" size="sm">{o.pm_type}</Badge>
                                                    )}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="w-24 whitespace-normal break-words flex justify-start"
                                                    onClick={() => toggleDelivery(o.id, o.delivery_confirmed, fetchOrders)}
                                                >
                                                    {o.delivery_confirmed === 'true' ? (
                                                        <Badge variant="light" color="success" size="sm">ຈັດສົງແລ້ວ</Badge>
                                                    ) : (
                                                        <Badge variant="light" color="warning" size="sm">ຍັງບໍ່ທັນສົງ</Badge>
                                                    )}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="p-0"
                                                    onClick={() => deleteOrder(o.id, fetchOrders)}
                                                >
                                                    <Badge variant="solid" color="error" size="sm">ຍົກເລີກ</Badge>
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {orders.length === 0 && (
                                    <TableRow>
                                        <TableCell className="px-4 py-6 w-full text-center text-gray-500 dark:text-gray-400">
                                            ບໍ່ມີລາຍການ
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>

            {/* aggregates for current page */}
            <div className="flex items-center justify-end gap-4 mt-4 text-sm text-gray-700 dark:text-gray-300">
                <div>Count: <span className="font-medium">{ordersCount}</span></div>
                <div>Items: <span className="font-medium">{ordersTotalQty}</span></div>
                <div>ເງີນລວມ: <span className="font-medium">{ordersTotalRevenue.toLocaleString('en-US')} ₭</span></div>
            </div>

            {/* grand total by payee (all pages) */}
            <div className="flex items-center justify-end gap-4 mt-2 text-sm text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">ລວມທັງໝົດຕາມຜູ້ຮັບເງີນ:</p>
                    <ul className="space-y-1">
                        {Object.entries(totalAllPayeeTotals).length === 0 ? (
                            <li className="text-gray-500">No payees</li>
                        ) : (
                            Object.entries(totalAllPayeeTotals).map(([name, total]) => (
                                <li key={name} className="text-gray-700 dark:text-gray-200">{name}: <span className="font-medium text-blue-600 dark:text-blue-400">{(total || 0).toLocaleString('en-US')} ₭</span></li>
                            ))
                        )}
                    </ul>
                </div>
            </div>

            {/* grand total (all pages) */}
            <div className="flex items-center justify-end gap-4 col-span-1 mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-3">
                <div>ເງີນລວມທັງໝົດ: <span className="text-lg text-blue-600 dark:text-blue-400">{loadingTotal ? '...' : totalAllOrdersRevenue.toLocaleString('en-US')} ₭</span></div>
            </div>

            {/* pagination controls */}
            <div className="flex items-center justify-end gap-2 mt-4">
                <Button size="sm" className="h-6" variant="outline" disabled={page <= 1} onClick={() => fetchOrders(page - 1)}>
                    Prev
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {Math.ceil(totalCount / perPage) || 1}</span>
                <Button size="sm" className="h-6" variant="outline" disabled={page >= Math.ceil(totalCount / perPage)} onClick={() => fetchOrders(page + 1)}>
                    Next
                </Button>
            </div>

            {isOpen && selectedOrder && (
                <div className='relative z-99999'>
                    <div className="fixed inset-0 bg-black opacity-50 flex items-center justify-center z-998 p-4"></div>
                    <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-999 p-4" onClick={closeModal}>
                        <div className="bg-gray-100 rounded-lg shadow-lg max-w-2xl w-full max-h-[95vh] overflow-x-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="sticky top-0 flex justify-between items-center p-4 border-b bg-white ">
                                <h3 className="text-lg font-bold ">ໃບສໍາລັບການສັ່ງ</h3>
                                <button onClick={closeModal} className="text-2xl font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">×</button>
                            </div>
                            <div className="p-1">
                                <InvoiceContent order={selectedOrder} />
                            </div>
                        </div>
                    </div>
                </div>

            )}
        </div>
    )
}
