import { useState, useEffect } from "react";
import swal from 'sweetalert';
import { supabase } from "../../lib/supabase";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import Button from "../../components/ui/button/Button";
import { useProducts } from "./useProducts";
import { useProductActions } from "./useProductActions";

export default function Index_Product() {
    const { products, loading, error, fetchProducts, page, perPage, totalCount } = useProducts() as any;

    // aggregates for visible products on the page
    const productCount = products?.length || 0
    // remaining inventory and value should reflect stock left
    const totalStock = products.reduce((s: number, p: any) => s + (p.qty_stock || 0), 0)
    // low‑level filters
    const [filterCate, setFilterCate] = useState("");
    const [showArchived] = useState(true);
    const [categories, setCategories] = useState<{ id: number, name: string }[]>([]);
    const [totals, setTotals] = useState({ cost: 0, target: 0, actual: 0 });
    const [loadingTotal, setLoadingTotal] = useState(true)

    // Fetch grand total calculations on mount
    useEffect(() => {
        const fetchGrandTotal = async () => {
            try {
                setLoadingTotal(true)
                const { data: allProducts } = await supabase
                    .from('Product')
                    .select('*, phase_id!inner(status)')
                    .eq('phase_id.status', 'active')
                let cost = 0, target = 0, actual = 0;
                if (allProducts) {
                    allProducts.forEach((p: any) => {
                        // ต้นทุน = quantity * cost_price
                        cost += (p.quantity || 0) * (p.cost_price || 0);
                        // เงินเป้า = quantity * sell_price
                        target += (p.quantity || 0) * (p.sell_price || 0);
                        // ยอด = qty_sale * sell_price
                        actual += (p.qty_sale || 0) * (p.sell_price || 0);
                    })
                }
                setTotals({ cost, target, actual });
            } catch (err) {
                console.error('Failed to fetch grand total:', err)
            } finally {
                setLoadingTotal(false)
            }
        }
        fetchGrandTotal()
    }, [])

    const { handleCreate, handleEdit, handleDelete, exportCsv } =
        useProductActions(filterCate, fetchProducts, products);

    // wrapper that applies current filters (category & archived) and optionally page
    const refreshProducts = async (pageNum: number = page) => {
        await fetchProducts({ cate_id: filterCate ? parseInt(filterCate) : undefined, archived: showArchived }, pageNum);
    };

    // initial load & refetch when archived toggle changes
    useEffect(() => {
        refreshProducts(1);
    }, [showArchived]);

    useEffect(() => {
        supabase.from("Category").select("id, name").then(res => {
            if (res.data) setCategories(res.data as any);
        });
    }, []);

    const handleCategoryFilterChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setFilterCate(val);
        await refreshProducts(1);
    };

    // render logic with filters/search/export
    if (error) {
        return (
            <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-900 dark:text-red-200">
                {error}
            </div>
        );
    }

    // when a row is clicked, prompt the user to either archive the product or increase its quantity
    const plusArchived = async (product: any) => {
        if ((product.qty_stock || 0) > 0) {
            // only offer prompt when stock exhausted
            return;
        }

        swal({
            title: 'ເລືອກການກະທຳ',
            text: 'ທ່ານຕ້ອງການເກັບສິນຄ້າ ຫຼື ເພີ່ມຈຳນວນ?',
            buttons: {
                archive: {
                    text: 'ເກັບ',
                    value: 'archive',
                    className: 'swal-button swal-button-info',
                },
                plus: {
                    text: 'ເພີ່ມຈຳນວນ',
                    value: 'plus',
                    className: 'swal-button swal-button-success',
                },
                cancel: {
                    text: 'ຍົກເລີກ',
                    value: null,
                    className: 'swal-button swal-button--cancel',
                },
            },
            dangerMode: true,
        }).then(async (choice) => {
            if (!choice) return;
            try {
                if (choice === 'archive') {
                    // look for any order items referencing this product
                    const { error: fkErr, count } = await supabase
                        .from('OrderItem')
                        .select('pro_id', { count: 'exact' })
                        .eq('pro_id', product.id);
                    if (fkErr) throw fkErr;
                    if (typeof count === 'number' && count > 0) {
                        // product is used elsewhere, just mark archived
                        const { error } = await supabase
                            .from('Product')
                            .update({ is_archived: true })
                            .eq('id', product.id);
                        if (error) throw error;
                        swal('ສຳເລັດ!', 'ສິນຄ້າຖືກເກັບແລ້ວ', 'success');
                    } else {
                        // no references - safe to delete entirely
                        const { error } = await supabase
                            .from('Product')
                            .delete()
                            .eq('id', product.id);
                        if (error) throw error;
                        swal('ສຳເລັດ!', 'ສິນຄ້າຖືກເກັບແລ້ວ', 'success');
                    }
                } else if (choice === 'plus') {
                    const qty = await swal({
                        title: 'ເພີ່ມຈຳນວນ',
                        text: 'ໃສ່ຈຳນວນທີ່ຈະເພີ່ມ',
                        content: {
                            element: 'input',
                            attributes: {
                                type: 'number',
                                min: 0,
                                step: 1,
                            },
                        },
                        buttons: {
                            confirm: {
                                text: 'ເພີ່ມ',
                                closeModal: false,
                            },
                        },
                    });
                    const add = parseInt(qty as string, 10);
                    if (!isNaN(add) && add > 0) {
                        const newQty = (product.quantity || 0) + add;
                        const newStock = (product.qty_stock || 0) + add;
                        const { error } = await supabase
                            .from('Product')
                            .update({ quantity: newQty, qty_stock: newStock })
                            .eq('id', product.id);
                        if (error) throw error;
                        swal('ສຳເລັດ!', 'ເພີ່ມຈຳນວນສິນຄ້າແລ້ວ', 'success');
                    } else {
                        swal('ຜິດພາດ!', 'ຈຳນວນບໍ່ຖືກຕ້ອງ', 'error');
                    }
                }
                // refresh list after modification
                await refreshProducts(page);
            } catch (err: any) {
                swal('ຜິດພາດ!', err.message || 'เกิดข้อผิดพลาด', 'error');
            }
        });
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-2 w-auto">
                <div className="flex flex-wrap items-center justify-start gap-2">
                    <Button size="sm" className='h-6' variant="outline" onClick={handleCreate}>
                        ເພີ່ມລາຍການ
                    </Button>
                    <Button size="sm" className='h-6' variant="outline" onClick={() => refreshProducts(page)}>
                        Refresh
                    </Button>
                    <Button size="sm" className='h-6' variant="outline" onClick={exportCsv}>
                        Export Excel
                    </Button>
                </div>
                <div className="flex flex-wrap items-center justify-end mb-2 gap-2">
                    <select
                        value={filterCate}
                        onChange={handleCategoryFilterChange}
                        className="px-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    >
                        <option value="" >ຄົ້ນຫາ / ປະເພດ</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
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
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
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
                            {/* Table Header */}
                            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                                <TableRow>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        #
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ຮູບ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ສິນຄ້າ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ລະຫັດ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ນຳເຂົ້າ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ຂາຍແລ້ວ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ຄ້າງເຫຼືອ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ປະເພດ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ຕົ້ນທຶນ
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
                                        ຜູ້ສ້າງ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ຈັດການ
                                    </TableCell>
                                </TableRow>
                            </TableHeader>

                            {/* Table Body */}
                            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                            
                                {products.map((product: any, idx: number) => (
                                    <TableRow onClick={() => plusArchived(product)} key={product.id} className={`hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer ${(product.qty_stock || 0) === 0 ? 'bg-gray-400 dark:bg-gray-700' : ''}`}>
                                        <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400">
                                            {(page - 1) * perPage + idx + 1}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            {product.pro_img ? (
                                                <div className="w-8 h-8 overflow-hidden rounded">
                                                    <img
                                                        src={product.pro_img}
                                                        alt={product.pro_name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            {product.pro_name}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            {product.sku}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            {product.quantity || 0}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            {product.qty_sale || 0}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            {product.qty_stock || 0}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            {product.cate_id?.name || "N/A"}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            <span className=" w-1.5">{product.cost_price?.toLocaleString()} LAK</span>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            <span className=" w-2xl ">{product.sell_price?.toLocaleString()} LAK</span>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            {product.user?.fullname || "N/A"}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEdit(product.id);
                                                    }}
                                                    className="px-3 py-1 w-18 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-sm hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                                                >
                                                    ແກ້ໄຂໍ້ມູນ
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(product.id);
                                                    }}
                                                    className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-sm hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                                                >
                                                    ລົບ
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {products.length === 0 && !loading && (
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
                <div>ລາຍການ: <span className="font-medium">{productCount}</span></div>
                <div>Stock: <span className="font-medium">{totalStock}</span></div>
            </div>

            {/* grand total (all pages) - cost, target, actual */}
            <div className="flex flex-col gap-3 mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="grid grid-cols-2 md:flex items-center justify-end gap-8">
                    <div className="">
                        ຕົ້ນທຸນ: <span className="text-lg text-orange-600 dark:text-orange-400">
                            {loadingTotal ? '...' : totals.cost.toLocaleString('en-US')} LAK
                        </span>
                    </div>
                    <div className="">
                        ເງີນເປົ້າ: <span className="text-lg text-blue-600 dark:text-blue-400">
                            {loadingTotal ? '...' : totals.target.toLocaleString('en-US')} LAK
                        </span>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        ຍອດ: <span className="text-lg text-green-600 dark:text-green-400">
                            {loadingTotal ? '...' : totals.actual.toLocaleString('en-US')} LAK
                        </span>
                    </div>
                </div>
            </div>

            {/* pagination controls */}
            <div className="flex items-center justify-end gap-2 mt-4">
                <Button size="sm" className="h-6" variant="outline" disabled={page <= 1} onClick={() => refreshProducts(page - 1)}>
                    Prev
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {Math.ceil(totalCount / perPage) || 1}</span>
                <Button size="sm" className="h-6" variant="outline" disabled={page >= Math.ceil(totalCount / perPage)} onClick={() => refreshProducts(page + 1)}>
                    Next
                </Button>            </div>
        </div>
    );
}
