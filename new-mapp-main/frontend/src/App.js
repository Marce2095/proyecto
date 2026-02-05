import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import LoginPage from "@/pages/LoginPage";
import POSPage from "@/pages/POSPage";
import AdminProductsPage from "@/pages/AdminProductsPage";
import SalesPage from "@/pages/SalesPage";
import ReportsPage from "@/pages/ReportsPage";
import { Toaster } from "@/components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getCurrentUser = () => {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

// Configurar interceptor de axios para manejar errores 401
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido o expirado
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

function PrivateRoute({ children, adminOnly = false }) {
  const user = getCurrentUser();
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/" />;
  }
  
  return children;
}

function App() {
  const [isSeeded, setIsSeeded] = useState(false);

  useEffect(() => {
    const seedDatabase = async () => {
      try {
        await axios.post(`${API}/seed`);
        setIsSeeded(true);
      } catch (error) {
        console.log("Database already seeded or error:", error.message);
        setIsSeeded(true);
      }
    };
    seedDatabase();
  }, []);

  if (!isSeeded) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-violet-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-slate-700">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <POSPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/products"
            element={
              <PrivateRoute adminOnly={true}>
                <AdminProductsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/sales"
            element={
              <PrivateRoute>
                <SalesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <PrivateRoute>
                <ReportsPage />
              </PrivateRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;