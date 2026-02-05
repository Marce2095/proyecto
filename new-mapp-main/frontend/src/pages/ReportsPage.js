import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API, getAuthHeader } from "@/App";
import { toast } from "sonner";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const CATEGORY_COLORS_MAP = {
  cold_drinks: "#22D3EE",
  hot_drinks: "#FB923C",
  snacks: "#F472B6"
};

const CATEGORY_LABELS = {
  cold_drinks: "Bebidas Frías",
  hot_drinks: "Bebidas Calientes",
  snacks: "Snacks"
};

export default function ReportsPage() {
  const [period, setPeriod] = useState("daily");
  const [reportData, setReportData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchReport();
  }, [period]);

  const fetchReport = async () => {
    try {
      const response = await axios.get(`${API}/reports/summary`, {
        headers: getAuthHeader(),
        params: { period }
      });
      setReportData(response.data);
    } catch (error) {
      toast.error("Error al cargar reporte");
    }
  };

  if (!reportData) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-violet-600"></div>
      </div>
    );
  }

  const categoryChartData = Object.entries(reportData.sales_by_category).map(([key, value]) => ({
    name: CATEGORY_LABELS[key] || key,
    value: value,
    fill: CATEGORY_COLORS_MAP[key] || "#94A3B8"
  }));

  const dailySalesChartData = reportData.daily_sales.map(item => ({
    date: new Date(item.date).toLocaleDateString("es-ES", { month: "short", day: "numeric" }),
    total: item.total
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b-2 border-slate-200 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              data-testid="back-to-pos-from-reports"
              onClick={() => navigate("/")}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="bg-white p-2 rounded-xl">
              <img 
                src="https://customer-assets.emergentagent.com/job_quicksale-pos-3/artifacts/vq6smd37_logo%20gaby%20sin%20fondo%20%282%29.png"
                alt="Mappuccinos Logo"
                className="w-10 h-10 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>
              Reportes de Ventas
            </h1>
          </div>

          <div className="flex gap-2">
            {["daily", "weekly", "monthly", "yearly"].map((p) => (
              <button
                key={p}
                data-testid={`period-${p}-button`}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  period === p
                    ? "bg-violet-600 text-white shadow-[0px_3px_0px_0px_rgba(91,33,182,1)]"
                    : "bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {p === "daily" && "Diario"}
                {p === "weekly" && "Semanal"}
                {p === "monthly" && "Mensual"}
                {p === "yearly" && "Anual"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div data-testid="total-sales-card" className="bg-white p-6 rounded-xl border-2 border-slate-200 shadow-sm">
            <p className="text-sm font-bold text-slate-600 mb-2">Ventas Totales</p>
            <p className="font-mono text-3xl font-bold text-violet-600">
              ${reportData.total_sales.toFixed(2)}
            </p>
          </div>
          <div data-testid="total-transactions-card" className="bg-white p-6 rounded-xl border-2 border-slate-200 shadow-sm">
            <p className="text-sm font-bold text-slate-600 mb-2">Transacciones</p>
            <p className="font-mono text-3xl font-bold text-cyan-600">
              {reportData.total_transactions}
            </p>
          </div>
          <div data-testid="avg-transaction-card" className="bg-white p-6 rounded-xl border-2 border-slate-200 shadow-sm">
            <p className="text-sm font-bold text-slate-600 mb-2">Promedio por Venta</p>
            <p className="font-mono text-3xl font-bold text-orange-600">
              ${reportData.total_transactions > 0 
                ? (reportData.total_sales / reportData.total_transactions).toFixed(2) 
                : "0.00"}
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales by Day Chart */}
          <div className="bg-white p-6 rounded-xl border-2 border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Ventas por Día</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailySalesChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" stroke="#64748B" />
                <YAxis stroke="#64748B" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "#FFFFFF", 
                    border: "2px solid #E2E8F0",
                    borderRadius: "8px",
                    fontWeight: "bold"
                  }}
                  formatter={(value) => `$${value.toFixed(2)}`}
                />
                <Bar dataKey="total" fill="#7C3AED" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Sales by Category Chart */}
          <div className="bg-white p-6 rounded-xl border-2 border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Ventas por Categoría</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "#FFFFFF", 
                    border: "2px solid #E2E8F0",
                    borderRadius: "8px",
                    fontWeight: "bold"
                  }}
                  formatter={(value) => `$${value.toFixed(2)}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products Table */}
        <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b-2 border-slate-200 bg-slate-50">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp size={24} />
              Top 10 Productos Más Vendidos
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">#</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Producto</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Cantidad Vendida</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Ingresos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.top_products.map((product, idx) => (
                  <tr key={idx} data-testid={`top-product-${idx}`} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-700">{idx + 1}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{product.product_name}</td>
                    <td className="px-6 py-4 font-bold text-cyan-600">{product.quantity}</td>
                    <td className="px-6 py-4 font-mono font-bold text-violet-600">
                      ${product.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
