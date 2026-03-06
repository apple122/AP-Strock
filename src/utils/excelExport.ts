import { supabase } from '../lib/supabase';

interface Phase {
  id: number;
  phase_name: string;
  status: string;
}

export const exportExcel = async (activePhase: Phase) => {
  try {
    console.log('Starting export...');
    console.log('Exporting for phase:', activePhase.phase_name);
    
    // Fetch data for the active phase only
    const fetchAllOrders = async () => {
      const { data, error } = await supabase
        .from('Order')
        .select(`*, OrderItem(*, pro_id(*, cate_id(*))), user_id(*), phase_id(phase_name)`)
        .eq('phase_id', activePhase.id)
        .order('id', { ascending: false });
      if (error) throw new Error(`Orders fetch error: ${error.message}`);
      return data as any[] || [];
    };

    const fetchAllExpenses = async () => {
      const { data, error } = await supabase
        .from('Expenses')
        .select(`*, user_id(*), payee_id(*), phase_id(id)`)
        .eq('phase_id', activePhase.id)
        .order('id', { ascending: false });
      if (error) throw new Error(`Expenses fetch error: ${error.message}`);
      return data as any[] || [];
    };

    const fetchAllProducts = async () => {
      const { data, error } = await supabase
        .from('Product')
        .select(`*, user(*), phase_id(phase_name), cate_id(*)`)
        .eq('phase_id', activePhase.id)
        .order('id', { ascending: false });
      if (error) throw new Error(`Products fetch error: ${error.message}`);
      return data as any[] || [];
    };

    // Fetch all data
    const [allOrders, allExpenses, allProducts] = await Promise.all([
      fetchAllOrders(),
      fetchAllExpenses(),
      fetchAllProducts()
    ]);
    
    console.log('All data fetched successfully');
    
    const orders = allOrders;
    const expenses = allExpenses;

    // Prepare Product data
    const productHeaders = ['#ເຟສ', 'ສິນຄ້າ', 'SKU', 'ນຳເຂົ້າ', 'ຈຳນວນຂາຍ', 'ຍັງສະຕ໋ອກ', 'ປະເພດ', 'ຕົ້ນທືນ', 'ລາຄາຂາຍ', 'ຜູ້ສ້າງ', 'ວັນທີ່ສ້າງ'];
    const productRows = allProducts.map(p => [
      p.phase_id?.phase_name || '',
      p.pro_name,
      p.sku,
      p.quantity,
      p.qty_sale || 0,
      p.qty_stock || 0,
      p.cate_id?.name || '',
      p.cost_price,
      p.sell_price,
      p.user?.fullname || '',
      p.created_at || '',
    ]);

    // Prepare Order data
    const orderHeaders = ['ເວລາ', 'ການຈ່າຍ', 'ຈຳນວນລວມ', 'ເງີນລວມ', 'ຜູ້ຮັບເງີນ', 'ລາຍການ', 'ຜູ້ອອກບີນ', 'ຈັດສົ່ງ'];
    const orderRows = orders.map(o => {
      const items = (o.OrderItem || [])
        .map((it: any) => `${it.pro_id?.pro_name || ''} x ${it.qty} @ ${it.price?.toLocaleString('en-US')} ₭`)
        .join(' | ');
      return [
        o.created_at ? new Date(o.created_at).toLocaleString() : '',
        o.pm_type || '',
        o.total_qty ?? '',
        o.sale_price ?? '',
        o.payee ?? '',
        items,
        o.user_id?.fullname || '',
        o.address || '',
      ];
    });

    // Prepare OrderItem data
    const orderItemHeaders = ['ສິນຄ້າ', 'ປະເພດ', 'ຈຳນວນ', 'ລາຄາຈີງ', 'ລາຄາຂາຍລວມ', 'ອໍເດີ'];
    const orderItemRows = orders.flatMap(o =>
      (o.OrderItem || []).map((it: any) => {
        const isPromo = o.promotion && o.promotion > 0;
        const total = isPromo ? (o.promotion || 0) * (it.qty || 0) : (it.price || 0) * (it.qty || 0);
        return [
          it.pro_id?.pro_name || '',
          it.pro_id?.cate_id?.name || '',
          it.qty || 0,
          (it.price || 0).toLocaleString('en-US'),
          total.toLocaleString('en-US'),
          `Order #${o.order || o.id}`,
        ];
      })
    );

    // Prepare Expenses data
    const expenseHeaders = ['ເວລາ', 'ຈຳນວນເງີນ', 'ຜູ້ຮັບເງີນ', 'ລາຍລະອຽດ', 'ຜູ້ສ້າງ'];
    const expenseRows = expenses.map(e => [
      e.created_at ? new Date(e.created_at).toLocaleString() : '',
      e.amount ?? '',
      e.payee_id?.name || '',
      e.description || '',
      e.user_id?.fullname || '',
    ]);

    // Prepare Summary Report
    const totalIncome = orders.reduce((sum, order) => sum + (order.sale_price || 0), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const totalProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (totalProfit / totalIncome * 100) : 0;
    
    const summaryRows = [
      ['ລາຍຮັບລວມ', totalIncome.toLocaleString('en-US') + ' ₭'],
      ['ລາຍຈ່າຍລວມ', totalExpenses.toLocaleString('en-US') + ' ₭'],
      ['ກຳໄລລວມ', totalProfit.toLocaleString('en-US') + ' ₭'],
      ['ອັດຕາສ່ວນກຳໄລ', profitMargin.toFixed(2) + '%']
    ];
    
    // Prepare Payee Summary
    const payeeTotals: { [key: string]: number } = {};
    
    orders.forEach(order => {
      if (order.payee) {
        payeeTotals[order.payee] = (payeeTotals[order.payee] || 0) + (order.sale_price || 0);
      }
    });
    
    const payeeRows = Object.keys(payeeTotals)
      .sort()
      .map(payee => [
        payee,
        payeeTotals[payee].toLocaleString('en-US') + ' ₭'
      ]);

    // Combined Summary Sheet
    const combinedSummaryData = [
      [],
      ['ສະຫຼຸບລາຍງານທາງການເງິນ'],
      [],
      ...summaryRows.map(row => row),
      [],
      ['ຜູ້ຮັບເງີນລາຍລະອຽດ'],
      ...payeeRows.map(row => row),
    ];

    // Create Excel file with multiple sheets
    console.log('Creating Excel workbook...');
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    console.log('Workbook created');

    // Add sheets
    if (productRows.length > 0) {
      const productWs = XLSX.utils.aoa_to_sheet([productHeaders, ...productRows]);
      XLSX.utils.book_append_sheet(wb, productWs, 'ນຳເຂົ້າສິນຄ້າ');
    }

    if (orderRows.length > 0) {
      const orderWs = XLSX.utils.aoa_to_sheet([orderHeaders, ...orderRows]);
      XLSX.utils.book_append_sheet(wb, orderWs, 'ອໍເດີ້');
    }

    if (orderItemRows.length > 0) {
      const orderItemWs = XLSX.utils.aoa_to_sheet([orderItemHeaders, ...orderItemRows]);
      XLSX.utils.book_append_sheet(wb, orderItemWs, 'ລາຍການຂາຍ');
    }

    if (expenseRows.length > 0) {
      const expenseWs = XLSX.utils.aoa_to_sheet([expenseHeaders, ...expenseRows]);
      XLSX.utils.book_append_sheet(wb, expenseWs, 'ລາຍການໃຊ້ຈ່າຍ');
    }

    // Add Combined Summary Report sheet
    if (summaryRows.length > 0 || payeeRows.length > 0) {
      const combinedWs = XLSX.utils.aoa_to_sheet(combinedSummaryData);
      XLSX.utils.book_append_sheet(wb, combinedWs, 'ສະຫຼຸບລວມ');
    }

    // Generate filename with timestamp
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ລາຍງານລວມ-${ts}.xlsx`;
    console.log('Writing Excel file:', filename);
    XLSX.writeFile(wb, filename);
    console.log('Export completed successfully');

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Export all failed:', errorMessage, err);
    throw new Error(`Export failed: ${errorMessage}`);
  }
};
