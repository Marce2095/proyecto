import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API, getAuthHeader } from "@/App";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, Search } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORY_COLORS = {
  cold_drinks: { bg: "#22D3EE", text: "#083344", label: "Bebidas Frías" },
  hot_drinks: { bg: "#FB923C", text: "#431407", label: "Bebidas Calientes" },
  snacks: { bg: "#F472B6", text: "#500724", label: "Snacks" },
  extras: { bg: "#A78BFA", text: "#3B0764", label: "Extras" }
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "cold_drinks",
    cost: "",
    sale_price: "",
    employee_price: "",
    image_url: ""
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, [searchTerm]);

  const fetchProducts = async () => {
    try {
      const params = searchTerm ? { search: searchTerm } : {};
      const response = await axios.get(`${API}/products`, {
        headers: getAuthHeader(),
        params
      });
      setProducts(response.data);
    } catch (error) {
      toast.error("Error al cargar productos");
    }
  };

  const handleOpenDialog = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        category: product.category,
        cost: product.cost.toString(),
        sale_price: product.sale_price.toString(),
        employee_price: product.employee_price ? product.employee_price.toString() : "",
        image_url: product.image_url
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        category: "cold_drinks",
        cost: "",
        sale_price: "",
        employee_price: "",
        image_url: ""
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const data = {
        name: formData.name,
        category: formData.category,
        cost: parseFloat(formData.cost),
        sale_price: parseFloat(formData.sale_price),
        employee_price: formData.employee_price ? parseFloat(formData.employee_price) : 0,
        image_url: formData.image_url
      };

      if (editingProduct) {
        await axios.put(`${API}/products/${editingProduct.id}`, data, {
          headers: getAuthHeader()
        });
        toast.success("Producto actualizado");
      } else {
        await axios.post(`${API}/products`, data, {
          headers: getAuthHeader()
        });
        toast.success("Producto creado");
      }

      setShowDialog(false);
      fetchProducts();
    } catch (error) {
      toast.error("Error al guardar producto");
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("¿Estás seguro de eliminar este producto?")) return;

    try {
      await axios.delete(`${API}/products/${productId}`, {
        headers: getAuthHeader()
      });
      toast.success("Producto eliminado");
      fetchProducts();
    } catch (error) {
      toast.error("Error al eliminar producto");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b-2 border-slate-200 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              data-testid="back-button"
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
              Administración de Productos
            </h1>
          </div>
          <Button
            data-testid="add-product-button"
            onClick={() => handleOpenDialog()}
            className="bg-violet-600 hover:bg-violet-700 font-bold tactile-button"
          >
            <Plus size={20} className="mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </header>

      <div className="p-6">
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              data-testid="admin-search-input"
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-violet-600 focus:outline-none transition-colors font-medium"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Producto</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Categoría</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Costo</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Precio Venta</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Margen</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Vendidos</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-slate-900">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => {
                  const categoryColor = CATEGORY_COLORS[product.category];
                  const margin = ((product.sale_price - product.cost) / product.cost * 100).toFixed(0);
                  return (
                    <tr key={product.id} data-testid={`product-row-${product.id}`} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={product.image_url || "https://via.placeholder.com/50"}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                          <span className="font-medium text-slate-900">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                          style={{ backgroundColor: categoryColor.bg, color: categoryColor.text }}
                        >
                          {categoryColor.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-700">
                        ${product.cost.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-violet-600">
                        ${product.sale_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-bold">
                          +{margin}%
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700">
                        {product.times_sold}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            data-testid={`edit-product-${product.id}`}
                            onClick={() => handleOpenDialog(product)}
                            className="p-2 hover:bg-violet-50 text-violet-600 rounded-lg transition-colors"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            data-testid={`delete-product-${product.id}`}
                            onClick={() => handleDelete(product.id)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {editingProduct ? "Editar Producto" : "Nuevo Producto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="font-bold">Nombre</Label>
              <Input
                id="name"
                data-testid="product-name-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="category" className="font-bold">Categoría</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger data-testid="category-select" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_COLORS).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cost" className="font-bold">Costo (USD)</Label>
                <Input
                  id="cost"
                  data-testid="product-cost-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="sale_price" className="font-bold">Precio Venta (USD)</Label>
                <Input
                  id="sale_price"
                  data-testid="product-sale-price-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sale_price}
                  onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="employee_price" className="font-bold">Precio Empleado (USD)</Label>
                <Input
                  id="employee_price"
                  data-testid="product-employee-price-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.employee_price}
                  onChange={(e) => setFormData({ ...formData, employee_price: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="image_url" className="font-bold">URL de Imagen</Label>
              <Input
                id="image_url"
                data-testid="product-image-url-input"
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
                className="font-bold"
              >
                Cancelar
              </Button>
              <Button
                data-testid="save-product-button"
                type="submit"
                className="bg-violet-600 hover:bg-violet-700 font-bold tactile-button"
              >
                {editingProduct ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}