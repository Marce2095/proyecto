import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API, getAuthHeader, getCurrentUser } from "@/App";
import { toast } from "sonner";
import { ShoppingCart, Search, LogOut, BarChart3, Package, Plus, Minus, X, DollarSign, CreditCard, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORY_COLORS = {
  cold_drinks: { bg: "#22D3EE", text: "#083344", label: "Bebidas Frías" },
  hot_drinks: { bg: "#FB923C", text: "#431407", label: "Bebidas Calientes" },
  snacks: { bg: "#F472B6", text: "#500724", label: "Snacks" },
  extras: { bg: "#A78BFA", text: "#3B0764", label: "Extras" }
};

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [customerType, setCustomerType] = useState("customer");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [checkoutStep, setCheckoutStep] = useState(1);
  const navigate = useNavigate();
  const user = getCurrentUser();

  useEffect(() => {
    fetchTopProducts();
    fetchProducts();
  }, []);

  const fetchTopProducts = async () => {
    try {
      const response = await axios.get(`${API}/products/top?limit=9`, {
        headers: getAuthHeader()
      });
      setTopProducts(response.data);
    } catch (error) {
      toast.error("Error al cargar productos destacados");
    }
  };

  const fetchProducts = async () => {
    try {
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (searchTerm) params.search = searchTerm;
      
      const response = await axios.get(`${API}/products`, {
        headers: getAuthHeader(),
        params
      });
      setProducts(response.data);
    } catch (error) {
      toast.error("Error al cargar productos");
    }
  };

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      fetchProducts();
    }, 300);
    return () => clearTimeout(delaySearch);
  }, [selectedCategory, searchTerm]);

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    toast.success(`${product.name} agregado al carrito`);
  };

  const updateQuantity = (productId, delta) => {
    setCart(cart.map(item =>
      item.id === productId
        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
        : item
    ).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const price = getItemPrice(item);
      return sum + (price * item.quantity);
    }, 0);
  };

  const getItemPrice = (item) => {
    if (customerType === "employee" && item.employee_price && item.employee_price > 0) {
      return item.employee_price;
    }
    return item.sale_price;
  };

  const handleInitiateCheckout = () => {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    setShowCheckoutDialog(true);
    setCheckoutStep(1);
    setPaymentMethod("");
    setAmountPaid("");
  };

  const handlePaymentMethodSelect = (method) => {
    setPaymentMethod(method);
    if (method === "cash") {
      setCheckoutStep(2);
    } else {
      completeSale(method, 0, 0);
    }
  };

  const completeSale = async (method, paid, change) => {
    try {
      const saleData = {
        products: cart.map(item => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: getItemPrice(item),
          subtotal: getItemPrice(item) * item.quantity
        })),
        total: calculateTotal(),
        customer_type: customerType,
        payment_method: method,
        amount_paid: paid,
        change_amount: change
      };

      await axios.post(`${API}/sales`, saleData, {
        headers: getAuthHeader()
      });

      toast.success("Venta completada con éxito");
      setCart([]);
      setShowCheckoutDialog(false);
      setCustomerType("customer");
      setCheckoutStep(1);
      fetchTopProducts();
    } catch (error) {
      console.error("Error al procesar venta:", error);
      const errorMsg = error.response?.data?.detail || error.message || "Error al procesar la venta";
      toast.error(errorMsg);
    }
  };

  const handleCashPayment = () => {
    const paid = parseFloat(amountPaid);
    const total = calculateTotal();
    
    if (!paid || paid < total) {
      toast.error("El monto pagado debe ser mayor o igual al total");
      return;
    }
    
    const change = paid - total;
    completeSale("cash", paid, change);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const displayProducts = selectedCategory || searchTerm ? products : topProducts;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b-2 border-slate-200 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white p-2 rounded-xl">
              <img 
                src="https://customer-assets.emergentagent.com/job_quicksale-pos-3/artifacts/vq6smd37_logo%20gaby%20sin%20fondo%20%282%29.png"
                alt="Mappuccinos Logo"
                className="w-14 h-14 object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit' }}>Mappuccinos</h1>
              <p className="text-sm text-slate-600">Hola, {user?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              data-testid="nav-sales-button"
              onClick={() => navigate("/sales")}
              className="px-4 py-2 bg-white border-2 border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <DollarSign size={18} />
              Ventas
            </button>
            <button
              data-testid="nav-reports-button"
              onClick={() => navigate("/reports")}
              className="px-4 py-2 bg-white border-2 border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <BarChart3 size={18} />
              Reportes
            </button>
            {user?.role === "admin" && (
              <button
                data-testid="nav-admin-button"
                onClick={() => navigate("/admin/products")}
                className="px-4 py-2 bg-white border-2 border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <Package size={18} />
                Admin
              </button>
            )}
            <button
              data-testid="logout-button"
              onClick={handleLogout}
              className="px-4 py-2 bg-red-50 border-2 border-red-200 rounded-lg font-bold text-red-700 hover:bg-red-100 transition-colors flex items-center gap-2"
            >
              <LogOut size={18} />
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6 p-6 h-[calc(100vh-88px)]">
        {/* Products Area */}
        <div className="col-span-8 flex flex-col gap-6 overflow-hidden">
          {/* Search and Filters */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                data-testid="search-products-input"
                type="text"
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-violet-600 focus:outline-none transition-colors font-medium"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                data-testid="filter-all-button"
                onClick={() => setSelectedCategory(null)}
                className={`px-5 py-2 rounded-full font-bold text-sm transition-transform hover:scale-105 active:scale-95 ${
                  !selectedCategory
                    ? "bg-violet-600 text-white shadow-[0px_3px_0px_0px_rgba(91,33,182,1)]"
                    : "bg-white text-slate-700 border-2 border-slate-200"
                }`}
              >
                Todos
              </button>
              {Object.entries(CATEGORY_COLORS).map(([key, value]) => (
                <button
                  key={key}
                  data-testid={`filter-${key}-button`}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-5 py-2 rounded-full font-bold text-sm transition-transform hover:scale-105 active:scale-95 ${
                    selectedCategory === key
                      ? "shadow-[0px_3px_0px_0px_rgba(0,0,0,0.2)]"
                      : "opacity-80"
                  }`}
                  style={{
                    backgroundColor: value.bg,
                    color: value.text
                  }}
                >
                  {value.label}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto scroll-smooth">
            <div className="grid grid-cols-3 gap-4 pb-4">
              {displayProducts.map((product) => {
                const categoryColor = CATEGORY_COLORS[product.category];
                return (
                  <div
                    key={product.id}
                    data-testid={`product-card-${product.id}`}
                    onClick={() => addToCart(product)}
                    className="bg-white rounded-xl border-2 border-transparent hover:border-violet-500 transition-all duration-200 overflow-hidden cursor-pointer product-card group"
                  >
                    <div className="aspect-square overflow-hidden bg-slate-100">
                      <img
                        src={product.image_url || "https://via.placeholder.com/400"}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-4">
                      <div
                        className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-2"
                        style={{ backgroundColor: categoryColor.bg, color: categoryColor.text }}
                      >
                        {categoryColor.label}
                      </div>
                      <h3 className="font-bold text-slate-900 mb-2 line-clamp-1">{product.name}</h3>
                      <p className="font-mono text-2xl font-bold text-violet-600">
                        ${product.sale_price.toFixed(2)}
                      </p>
                      {product.employee_price > 0 && (
                        <p className="font-mono text-sm font-medium text-green-600">
                          Empleado: ${product.employee_price.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cart Area */}
        <div className="col-span-4 bg-white rounded-2xl border-2 border-slate-200 p-6 flex flex-col shadow-lg">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <ShoppingCart size={24} />
            Carrito
          </h2>

          {/* Customer Type Selector */}
          <div className="mb-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-sm font-bold text-slate-700 mb-2">Tipo de Cliente:</p>
            <div className="flex gap-2">
              <button
                data-testid="customer-type-customer"
                onClick={() => setCustomerType("customer")}
                className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm transition-all ${
                  customerType === "customer"
                    ? "bg-violet-600 text-white shadow-[0px_2px_0px_0px_rgba(91,33,182,1)]"
                    : "bg-white text-slate-700 border-2 border-slate-200"
                }`}
              >
                Cliente
              </button>
              <button
                data-testid="customer-type-employee"
                onClick={() => setCustomerType("employee")}
                className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm transition-all ${
                  customerType === "employee"
                    ? "bg-green-600 text-white shadow-[0px_2px_0px_0px_rgba(22,163,74,1)]"
                    : "bg-white text-slate-700 border-2 border-slate-200"
                }`}
              >
                Empleado
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mb-6">
            {cart.length === 0 ? (
              <div data-testid="empty-cart-message" className="text-center py-12">
                <ShoppingCart size={48} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">El carrito está vacío</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  data-testid={`cart-item-${item.id}`}
                  className="bg-slate-50 rounded-xl p-4 cart-item border-2 border-slate-100"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 mb-1">{item.name}</h3>
                      <p className="font-mono text-lg font-bold text-violet-600">
                        ${getItemPrice(item).toFixed(2)}
                      </p>
                    </div>
                    <button
                      data-testid={`remove-item-${item.id}`}
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        data-testid={`decrease-quantity-${item.id}`}
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-8 h-8 flex items-center justify-center bg-white border-2 border-slate-200 rounded-lg hover:bg-slate-50 font-bold"
                      >
                        <Minus size={16} />
                      </button>
                      <span data-testid={`quantity-${item.id}`} className="w-12 text-center font-bold text-lg">
                        {item.quantity}
                      </span>
                      <button
                        data-testid={`increase-quantity-${item.id}`}
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white border-2 border-slate-200 rounded-lg hover:bg-slate-50 font-bold"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <p className="font-mono text-lg font-bold text-slate-900">
                      ${(getItemPrice(item) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t-2 border-slate-200 pt-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-slate-900">Total:</span>
              <span data-testid="cart-total" className="font-mono text-3xl font-bold text-violet-600">
                ${calculateTotal().toFixed(2)}
              </span>
            </div>
            <button
              data-testid="checkout-button"
              onClick={handleInitiateCheckout}
              disabled={cart.length === 0}
              className="w-full bg-violet-600 text-white font-bold py-4 px-6 rounded-lg tactile-button hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              Procesar Venta
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {checkoutStep === 1 ? "Método de Pago" : "Pago en Efectivo"}
            </DialogTitle>
          </DialogHeader>
          
          {checkoutStep === 1 ? (
            <div className="space-y-3 py-4">
              <button
                data-testid="payment-cash-button"
                onClick={() => handlePaymentMethodSelect("cash")}
                className="w-full p-6 bg-green-50 border-2 border-green-200 rounded-xl hover:bg-green-100 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                    <DollarSign size={24} className="text-white" />
                  </div>
                  <span className="text-xl font-bold text-green-900">Efectivo</span>
                </div>
              </button>

              <button
                data-testid="payment-card-button"
                onClick={() => handlePaymentMethodSelect("card")}
                className="w-full p-6 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <CreditCard size={24} className="text-white" />
                  </div>
                  <span className="text-xl font-bold text-blue-900">Tarjeta</span>
                </div>
              </button>

              <button
                data-testid="payment-transfer-button"
                onClick={() => handlePaymentMethodSelect("transfer")}
                className="w-full p-6 bg-purple-50 border-2 border-purple-200 rounded-xl hover:bg-purple-100 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                    <Smartphone size={24} className="text-white" />
                  </div>
                  <span className="text-xl font-bold text-purple-900">Transferencia</span>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-sm text-slate-600 mb-1">Total a pagar:</p>
                <p className="font-mono text-3xl font-bold text-violet-600">
                  ${calculateTotal().toFixed(2)}
                </p>
              </div>

              <div>
                <Label htmlFor="amount-paid" className="font-bold mb-2 block">Con cuánto paga:</Label>
                <Input
                  id="amount-paid"
                  data-testid="amount-paid-input"
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0.00"
                  className="text-2xl font-mono font-bold"
                />
              </div>

              {amountPaid && parseFloat(amountPaid) >= calculateTotal() && (
                <div className="bg-green-50 p-4 rounded-xl border-2 border-green-200">
                  <p className="text-sm text-green-700 font-medium mb-1">Cambio:</p>
                  <p data-testid="change-amount" className="font-mono text-2xl font-bold text-green-600">
                    ${(parseFloat(amountPaid) - calculateTotal()).toFixed(2)}
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCheckoutStep(1)}
                  className="font-bold"
                >
                  Atrás
                </Button>
                <Button
                  data-testid="complete-cash-sale-button"
                  onClick={handleCashPayment}
                  className="bg-violet-600 hover:bg-violet-700 font-bold tactile-button"
                >
                  Completar Venta
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}