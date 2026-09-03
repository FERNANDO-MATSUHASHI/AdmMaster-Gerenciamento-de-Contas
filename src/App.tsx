import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import SupplierForm from "./pages/SupplierForm";
import BillForm from "./pages/BillForm";
import BillEdit from "./pages/BillEdit";
import BillDetail from "./pages/BillDetail";
import BillsList from "./pages/BillsList";
import BankForm from "./pages/BankForm";
import BanksList from "./pages/BanksList";
import BankEdit from "./pages/BankEdit";
import SupplierTypes from "./pages/SupplierTypes";
import ExpenseUsers from "./pages/ExpenseUsers";
import Reports from "./pages/Reports";
import ExpenseForm from "./pages/ExpenseForm";
import NotFound from "./pages/NotFound";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/fornecedores/novo" element={<ProtectedRoute><SupplierForm /></ProtectedRoute>} />
              <Route path="/contas/nova" element={<ProtectedRoute><BillForm /></ProtectedRoute>} />
              <Route path="/contas/editar/:id" element={<ProtectedRoute><BillEdit /></ProtectedRoute>} />
              <Route path="/conta/:id" element={<ProtectedRoute><BillDetail /></ProtectedRoute>} />
              <Route path="/contas" element={<ProtectedRoute><BillsList /></ProtectedRoute>} />
              <Route path="/bancos" element={<ProtectedRoute><BanksList /></ProtectedRoute>} />
              <Route path="/bancos/novo" element={<ProtectedRoute><BankForm /></ProtectedRoute>} />
              <Route path="/bancos/editar/:id" element={<ProtectedRoute><BankEdit /></ProtectedRoute>} />
              <Route path="/tipos-fornecedor" element={<ProtectedRoute><SupplierTypes /></ProtectedRoute>} />
              <Route path="/usuarios-despesas" element={<ProtectedRoute><ExpenseUsers /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/despesas/nova" element={<ProtectedRoute><ExpenseForm /></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
