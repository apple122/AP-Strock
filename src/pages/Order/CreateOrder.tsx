import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/button/Button'
import { useNavigate } from 'react-router'
import { Product as ProdType } from '../Product/useProducts'
import { useUser } from '../../context/UserContext'

interface LineItem {
    pro_id?: number
    pro_name?: string
    qty: number
    price?: number
    sell_price?: number
    pro_img?: string
    stock?: number    // available quantity at time of selection
}

export default function CreateOrder() {
    const user = useUser().user;

    const navigate = useNavigate()
    const [products, setProducts] = useState<ProdType[]>([])
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<LineItem[]>([])
    const [pmType, setPmType] = useState('ຍັງບໍ່ຈ່າຍ')
    const [address, setAddress] = useState({ name: '', phone: '', branch: '', address: '' })
    const [promotion, setPromotion] = useState<number | ''>('')
    const [payee, setPayee] = useState('')
    const [payees, setPayees] = useState<{ id: number; name: string }[]>([])
    const [showAddItem, setShowAddItem] = useState(false)
    const [selectedQty, setSelectedQty] = useState(1)

    useEffect(() => {
        // load products for selection (include current stock quantity)
        supabase
            .from('Product')
            .select(
                `*,
          user(*),
          cate_id(*),
          phase_id!inner(phase_name, status)`,
                { count: 'exact' }
            )
            .eq('phase_id.status', 'active')
            .order('id', { ascending: false })
            .order('is_archived', { ascending: true })
            .then(res => {
                if (res.data) setProducts(res.data as any)
            })
    }, [])

    useEffect(() => {
        // load payees for the select
        supabase
            .from('Payee')
            .select('id, name')
            .then(res => {
                if (res.data) setPayees(res.data as any)
            })
    }, [])

    const removeLine = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))
    const updateLine = (idx: number, patch: Partial<LineItem>) =>
        setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

    const addItemFromProduct = (product: ProdType) => {
        // Check available stock
        const stock = product.qty_stock ?? 0
        if (stock <= 0) {
            alert('ຈຳນວນສິນຄ້າໃນສະຕ໋ອກເບີດແລ້ວ')
            setShowAddItem(false)
            return
        }

        // Check if product already exists
        const existingIndex = items.findIndex(it => it.pro_id === product.id)

        if (existingIndex !== -1) {
            // Product already exists, increase quantity; also refresh stock
            const currentQty = items[existingIndex].qty
            const currentStock = stock // latest from product
            const newQty = currentQty + selectedQty
            if (newQty > currentStock) {
                alert(`Cannot add more than ${currentStock} items available`)
                updateLine(existingIndex, { qty: currentStock, stock: currentStock })
            } else {
                updateLine(existingIndex, { qty: newQty, stock: currentStock })
            }
        } else {
            // Add new item (cap to stock)
            const qtyToAdd = Math.min(selectedQty, stock)
            const newItem: LineItem = {
                pro_id: product.id,
                pro_name: product.pro_name,
                sell_price: product.sell_price,
                pro_img: product.pro_img,
                qty: qtyToAdd,
                price: product.sell_price,
                stock,
            }
            setItems(prev => [...prev, newItem])
            if (qtyToAdd < selectedQty) {
                alert(`Only ${stock} units available, added ${qtyToAdd}`)
            }
        }
        setSelectedQty(1)
        setShowAddItem(false)
    }

    const computeTotalQty = () => items.reduce((s, it) => s + (it.qty || 0), 0)
    const computeSalePrice = () => {
        // if promotion provided, use that as per-item price
        if (promotion !== '') return (promotion as number) * computeTotalQty()
        return items.reduce((s, it) => s + ((it.price || 0) * it.qty), 0)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (items.length === 0) {
            alert('ເລືອກລາຍການຢ່າງໜ້ອຍ 1 ລາຍການ')
            return
        }

        setLoading(true)
        try {
            // Get active phase
            const { data: activePhase } = await supabase
                .from('Phase')
                .select('id')
                .eq('status', 'active')
                .single()

            if (!activePhase) {
                alert('No active phase found. Please create a phase first.')
                setLoading(false)
                return
            }

            const totalQty = computeTotalQty()
            const salePrice = computeSalePrice()

            const { data: latestOrder } = await supabase
                .from('Order')
                .select('order')
                .order('id', { ascending: false })
                .limit(1)
                .maybeSingle()

            const order_count = latestOrder?.order ? latestOrder.order + 1 : 1


            const orderPayload: any = {
                pm_type: pmType,
                sale_price: salePrice,
                address: address,
                total_qty: totalQty,
                delivery_confirmed: 'false',
                promotion: promotion === '' ? null : promotion,
                payee: payee || null,
                user_id: user?.id || null,
                order: (order_count || 1), // simple incremental order number
                phase_id: activePhase.id,
            }

            const { data: orderData, error: orderErr } = await supabase
                .from('Order')
                .insert([orderPayload])
                .select('id')
                .single()

            if (orderErr) throw orderErr

            const orderId = (orderData as any).id

            // insert order items
            const itemsPayload = items.map(it => ({
                order_id: orderId,
                pro_id: it.pro_id,
                qty: it.qty,
                price: it.price || it.sell_price || null,
                phase_id: activePhase.id,
            }))

            const { error: itemsErr } = await supabase.from('OrderItem').insert(itemsPayload)
            if (itemsErr) throw itemsErr

            // decrement product quantities
            for (const it of items) {
                if (!it.pro_id) continue
                // fetch current quantity (could be omitted if you trust the local state)
                const { data: prodData, error: prodErr } = await supabase
                    .from('Product')
                    .select('qty_stock, qty_sale')
                    .eq('id', it.pro_id)
                    .single()
                if (prodErr) {
                    console.error('failed to fetch product for qty update', prodErr)
                    // continue with others
                } else if (prodData) {
                    const newQty = (prodData.qty_stock || 0) - it.qty
                    await supabase
                        .from('Product')
                        .update({
                            qty_sale: (prodData.qty_sale || 0) + it.qty,
                            qty_stock: newQty < 0 ? 0 : newQty
                        })
                        .eq('id', it.pro_id)
                }
            }

            window.dispatchEvent(new Event("refresh-notifications"));
            navigate('/order')
        } catch (err) {
            console.error(err)
            alert('Failed to create order')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto">
            {/* <h1 className="text-2xl font-bold mb-4">Create Order</h1> */}
            <form onSubmit={handleSubmit} className="space-y-4 border border-gray-200 dark:border-gray-500 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white p-6 rounded shadow">
                <div>
                    <label className="block text-sm font-medium mb-2">Items</label>

                    {/* Items List */}


                    {/* Add Item Dropdown */}
                    <div className="relative mb-3">
                        <button
                            type="button"
                            onClick={() => setShowAddItem(!showAddItem)}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                        >
                            <span>+ ເລືອກລາຍການ</span>
                            <span className={`transition-transform ${showAddItem ? 'rotate-180' : ''}`}>▼</span>
                        </button>

                        {/* Dropdown Menu */}
                        {showAddItem && (
                            <div className="absolute top-full left-0 mt-1 bg-gray-100 dark:bg-gray-800 border text-gray-900 dark:text-white border-gray-200 dark:border-gray-500 rounded shadow-lg max-h-96 min-w-75 overflow-y-auto w-auto z-10">
                                <div className="p-3 border-b border-gray-200 dark:border-gray-500 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white sticky top-0">
                                    <label className="block text-sm font-medium text-gray-900 dark:text-white">ລາຍການສິນຄ້າ</label>
                                </div>
                                <div className="divide-y">
                                    {products.map(product => (
                                        <div
                                            key={product.id}
                                            onClick={() => addItemFromProduct(product)}
                                            className="flex justify-between items-center p-3 hover:bg-gray-200 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-500 cursor-pointer transition-colors "
                                        >
                                            <div className="flex items-center flex-1 gap-3 min-w-0">
                                                {product.pro_img ? (
                                                    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                                                        <img src={product.pro_img} alt={product.pro_name} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-200 rounded flex-shrink-0" />
                                                )}
                                                <div className="min-w-0">
                                                    <div className="font-medium text-sm truncate text-gray-900 dark:text-white">{product.pro_name}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0 ml-2 ">
                                                <div className=" text-gray-900 dark:text-white">{product.sell_price?.toLocaleString('en-US')} ₭</div>
                                                {product.qty_stock !== undefined && (
                                                    <div className="text-xs text-gray-900 dark:text-white">(stock: {product.qty_stock || 0})</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    {items.length > 0 && (
                        <div className="mb-4 bg-gray-200 dark:bg-white/[0.03] rounded p-3 space-y-2">
                            {items.map((it, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white dark:bg-white/[0.03] p-2 rounded ">
                                    <div className="flex items-center flex-1 gap-3 ">
                                        {it.pro_img ? (
                                            <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                                                <img src={it.pro_img} alt={it.pro_name} className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 bg-gray-200 rounded flex-shrink-0" />
                                        )}
                                        <div>
                                            <div className="font-medium text-sm">{it.pro_name || `Product ${it.pro_id}`}</div>
                                            <div className="text-xs text-gray-600 dark:text-gray-300">Price: {it.sell_price?.toLocaleString('en-US')} ₭</div>
                                            {it.stock !== undefined && (
                                                <div className="text-xs text-gray-600 dark:text-gray-300">stock: {it.stock}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => updateLine(idx, { qty: Math.max(1, it.qty - 1) })}
                                            className="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 font-medium"
                                        >
                                            −
                                        </button>
                                        <span className="text-sm font-medium w-6 text-center">{it.qty}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const maxQty = it.stock ?? Infinity
                                                const desired = it.qty + 1
                                                if (desired > maxQty) {
                                                    alert(`Only ${maxQty} available`)
                                                    updateLine(idx, { qty: maxQty })
                                                } else {
                                                    updateLine(idx, { qty: desired })
                                                }
                                            }}
                                            disabled={it.stock !== undefined && it.qty >= it.stock}
                                            className="px-2 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200 font-medium disabled:opacity-50"
                                        >
                                            +
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeLine(idx)}
                                            className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                                        >
                                            ລົບ
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">ການຈ່າຍ</label>
                    <select value={pmType} onChange={e => setPmType(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-200 dark:bg-gray-700">
                        <option value="ໂອນ">ໂອນ</option>
                        <option value="ຈ່າຍສົດ">ຈ່າຍສົດ</option>
                        <option value="ຍັງບໍ່ຈ່າຍ">ຍັງບໍ່ຈ່າຍ</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">ຈັດສົງ</label>
                    <input placeholder="ຊື່" value={address.name} onChange={e => setAddress({ ...address, name: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-200 dark:bg-white/[0.03] mb-2" />
                    <input placeholder="ເບີໂທ" value={address.phone} onChange={e => setAddress({ ...address, phone: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-200 dark:bg-white/[0.03] mb-2" />
                    <div className='mb-2'>
                        <select value={address.branch} onChange={e => setAddress({ ...address, branch: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-200 dark:bg-gray-700">
                            <option value="">ເລືອກສາຂາ</option>
                            <option value="ອານຸສິດ">ອານຸສິດ</option>
                            <option value="ຮຸ່ງອາລຸນ">ຮຸ່ງອາລຸນ</option>
                            <option value="ມີໄຊ">ມີໄຊ</option>
                        </select>
                    </div>
                    <input placeholder="ທີ່ຢູ່" value={address.address} onChange={e => setAddress({ ...address, address: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-200 dark:bg-white/[0.03]" />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">ລາຄາໂປຣ (ຈະໄສ່ ຫຼື ບໍ່ກະໄດ້)</label>
                    <input type="number" value={promotion === '' ? '' : promotion} onChange={e => setPromotion(e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-full px-3 py-2 rounded bg-gray-200 dark:bg-white/[0.03]" />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">ຜູ້ຮັບເງີນ</label>
                    <select required value={payee} onChange={async (e) => {
                        const val = e.target.value
                        if (val === 'newPayee') {
                            const name = window.prompt('Enter new payee name')
                            if (!name || !name.trim()) {
                                setPayee('')
                                return
                            }
                            try {
                                const { data: newPayee, error: payeeErr } = await supabase
                                    .from('Payee')
                                    .insert([{ name: name.trim() }])
                                    .select('id, name')
                                    .single()
                                if (payeeErr) throw payeeErr
                                if (newPayee) {
                                    setPayees(prev => [...prev, newPayee])
                                    setPayee(newPayee.name)
                                }
                            } catch (err) {
                                console.error('Failed to add payee', err)
                                alert('Failed to add payee')
                            }
                        } else {
                            setPayee(val)
                        }
                    }} className="w-full px-3 py-2 rounded bg-gray-200 dark:bg-gray-700">
                        <option value="">ເລືອກຜູ້ຮັບເງີນ</option>
                        {payees.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                        <option value="newPayee">+ ເພີມຜູ້ຮັບເງີນ</option>
                    </select>
                </div>

                <div className="bg-gray-200 dark:bg-white/[0.03] p-3 rounded border border-none">
                    <div className="text-sm font-medium">ຈຳນວນລວມ: <span className="text-blue-600">{computeTotalQty()}</span> ລາຍການ</div>
                    <div className="text-sm font-medium mt-1">ເງີນລວມ: <span className="text-2xl text-green-600">{computeSalePrice().toLocaleString('en-US')} ₭</span></div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate('/order')}>ຍົກເລີກ</Button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded" disabled={loading}>{loading ? 'ກຳລັງບັນທືກ...' : 'ບັນທືກອໍເດີ້'}</button>
                </div>
            </form>
        </div>
    )
}
