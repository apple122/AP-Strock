import { useCallback } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../lib/supabase";
import * as XLSX from "xlsx";
import { Product } from "./useProducts";

export function useProductActions(
    filterCate: string,
    fetchProducts: (opts?: { search?: string; cate_id?: number; archived?: boolean }, page?: number) => Promise<void>,
    products: Product[]
) {
    const navigate = useNavigate();

    const handleCreate = useCallback(() => {
        navigate("/product/create");
    }, [navigate]);

    const handleRefresh = useCallback(async () => {
        // reset back to first page
        await fetchProducts({ cate_id: filterCate ? parseInt(filterCate) : undefined }, 1);
    }, [filterCate, fetchProducts]);

    const handleEdit = useCallback((productId: number) => {
        navigate(`/product/edit/${productId}`);
    }, [navigate]);

    const handleDelete = useCallback(async (productId: number) => {
        if (!window.confirm(`ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລົບສິນຄ້ານີ້ ຫຼື ບໍ່?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from("Product")
                .delete()
                .eq("id", productId);

            if (error) throw error;
            
            // Refresh the product list
            await fetchProducts({ cate_id: filterCate ? parseInt(filterCate) : undefined });
        } catch (err) {
            console.error("Error deleting product:", err);
            alert("ບໍ່ສາມາດລົບສິນຄ້າໄດ້");
        }
    }, [filterCate, fetchProducts]);

    const handleFilterChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        // reset to first page when applying new filter
        await fetchProducts({ cate_id: val ? parseInt(val) : undefined }, 1);
    }, [fetchProducts]);

    const exportCsv = useCallback(() => {
        if (!products || products.length === 0) return;

        // build a 2D array with header row followed by product data
        const headers = [
            "Image URL",
            "ໍສິນຄ້າ",
            "SKU",
            "ນຳເຂົ້າ",
            "ຈຳນວນຂາຍ",
            "ຍັງສະຕ໋ອກ",
            "ປະເພດສີນຄ້າ",
            "ຕົ້ນທືນ",
            "ລາຄາຂາຍ",
            "ຜູ້ສ້າງ",
            "ວັນທີ່ສ້າງ",
        ];
        const rows = products.map(p => [
            p.pro_img || "",
            p.pro_name,
            p.sku,
            p.quantity,
            p.qty_sale,
            p.qty_stock,
            p.cate_id?.name || "",
            p.cost_price,
            p.sell_price,
            p.user?.fullname || "",
            p.created_at || "",
        ]);

        const data = [headers, ...rows];
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "ນຳເຂົ້າສິນຄ້າ");

        // write and trigger download
        XLSX.writeFile(workbook, "ນຳເຂົ້າສິນຄ້າ.xlsx");
    }, [products]);

    return {
        handleCreate,
        handleRefresh,
        handleEdit,
        handleDelete,
        handleFilterChange,
        exportCsv,
    };
}
