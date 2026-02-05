import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";
import { Eye, EyeOff, Store } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      toast.success(`¡Bienvenido, ${response.data.user.name}!`);
      navigate("/");
    } catch (error) {
      toast.error("Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-pink-50 to-cyan-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-center mb-8">
            <div className="bg-white p-3 rounded-2xl shadow-lg">
              <img 
                src="https://customer-assets.emergentagent.com/job_quicksale-pos-3/artifacts/vq6smd37_logo%20gaby%20sin%20fondo%20%282%29.png"
                alt="Mappuccinos Logo"
                className="w-20 h-20 object-contain"
              />
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-center mb-2 text-slate-900" style={{ fontFamily: 'Outfit' }}>
            Mappuccinos
          </h1>
          <p className="text-center text-slate-600 mb-8">Sistema de Punto de Venta</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Email
              </label>
              <input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-violet-600 focus:outline-none transition-colors"
                placeholder="admin@pos.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  data-testid="login-password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-violet-600 focus:outline-none transition-colors pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 text-white font-bold py-4 px-6 rounded-lg tactile-button hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t-2 border-slate-100">
            <div className="text-sm text-slate-600 space-y-2">
              <p className="font-bold text-center mb-3">Credenciales de prueba:</p>
              <div className="bg-slate-50 p-3 rounded-lg space-y-1">
                <p><span className="font-semibold">Admin:</span> admin@pos.com / admin123</p>
                <p><span className="font-semibold">Cajero:</span> cashier@pos.com / cashier123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}