import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API, getAuthHeader } from "@/App";
import { toast } from "sonner";
import { ArrowLeft, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const response = await axios.get(`${API}/sales`, {
        headers: getAuthHeader()
      });
      setSales(response.data);
    } catch (error) {
      toast.error("Error al cargar ventas");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b-2 border-slate-200 shadow-sm">
        <div className="px-6 py-4 flex items-center gap-4">
          <button
            data-testid="back-to-pos-button"
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
            Historial de Ventas
          </h1>
        </div>
      </header>

      <div className="p-6">
        <div className="space-y-4">
          {sales.length === 0 ? (
            <div data-testid="no-sales-message" className="bg-white rounded-xl border-2 border-slate-200 p-12 text-center">
              <Calendar size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No hay ventas registradas</p>
            </div>
          ) : (
            sales.map((sale) => (
              <div
                key={sale.id}
                data-testid={`sale-card-${sale.id}`}
                className="bg-white rounded-xl border-2 border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-slate-600 font-medium">
                      {format(new Date(sale.date), "dd/MM/yyyy HH:mm")}
                    </p>
                    <p className="text-sm text-slate-500">
                      Cajero: <span className="font-semibold">{sale.cashier_name}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600 font-medium">Total</p>
                    <p data-testid={`sale-total-${sale.id}`} className="font-mono text-2xl font-bold text-violet-600">
                      ${sale.total.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="border-t-2 border-slate-100 pt-4 space-y-2">
                  {sale.products.map((item, idx) => (
                    <div
                      key={idx}
                      data-testid={`sale-item-${sale.id}-${idx}`}
                      className="flex items-center justify-between py-2"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{item.product_name}</p>
                        <p className="text-sm text-slate-500">
                          {item.quantity} x ${item.unit_price.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-mono font-bold text-slate-900">
                        ${item.subtotal.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}