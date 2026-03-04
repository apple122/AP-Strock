import RecentOrders from "../../components/ecommerce/RecentOrders";
import SalesMetrics from "../../components/ecommerce/SalesMetrics";

export default function Dashboard() {
  return (
    <>
      <div className="grid grid-cols-12 gap-4 md:gap-6">
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
