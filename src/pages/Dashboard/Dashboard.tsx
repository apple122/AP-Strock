import { useState, useEffect } from "react";
import RecentOrders from "../../components/ecommerce/RecentOrders";
import SalesMetrics from "../../components/ecommerce/SalesMetrics";
import { usePhases } from "../../hooks/usePhases";
import Button from "../../components/ui/button/Button";
import { exportExcel } from "../../utils/excelExport";

export default function Dashboard() {
  const { phases, createNewPhase, setActivePhase, loading } = usePhases();

  const [selectedPhase, setSelectedPhase] = useState<string>('');

  // keep selection in sync with active phase list
  useEffect(() => {
    const active = phases.find(p => p.status === 'active');
    if (active) {
      setSelectedPhase(active.id.toString());
    } else {
      setSelectedPhase('new');
    }
  }, [phases]);

  const handlePhaseChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedPhase(val);
    try {
      if (val === 'new') {
        await createNewPhase();
      } else {
        await setActivePhase(parseInt(val));
      }
    } catch (err) {
      console.error('Phase change failed:', err);
    }
  };

  const exportAll = async () => {
    try {
      // Get the currently active phase
      const activePhase = phases.find(p => p.status === 'active');
      if (!activePhase) {
        alert('Please select an active phase to export');
        return;
      }
      
      await exportExcel(activePhase);
      alert('Export completed successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Export failed:', errorMessage);
      alert(errorMessage);
    }
  };

  return (
    <>
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 space-y-6 xl:col-span-12">
          <div className="flex items-center gap-2">
            <span className="text-green-400">Online:</span>
            <select
              value={selectedPhase}
              onChange={handlePhaseChange}
              disabled={loading}
              className="h-8 text-sm rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <option value="new">+ ສ້າງຂໍ້ມູນໃໝ່</option>
              {phases.map(p => (
                <option key={p.id} value={p.id.toString()}>{p.phase_name}</option>
              ))}
            </select>

            <Button size="sm" className='h-8' variant="outline" onClick={exportAll}>
              Export All Excel
            </Button>

          </div>
        </div>

        <div className="col-span-12 space-y-6 xl:col-span-12">
          <SalesMetrics />
        </div>

        <div className="col-span-12 xl:col-span-12">
          <RecentOrders />
        </div>
      </div>
    </>
  );
}
