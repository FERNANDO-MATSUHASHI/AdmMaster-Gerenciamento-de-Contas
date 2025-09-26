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
import BillsList from "./pages/BillsList";
import BankForm from "./pages/BankForm";
import BanksList from "./pages/BanksList";
import BankEdit from "./pages/BankEdit";
import SupplierTypes from "./pages/SupplierTypes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/fornecedores/novo" element={<SupplierForm />} />
          <Route path="/contas/nova" element={<BillForm />} />
          <Route path="/contas/editar/:id" element={<BillEdit />} />
          <Route path="/contas" element={<BillsList />} />
          <Route path="/bancos" element={<BanksList />} />
          <Route path="/bancos/novo" element={<BankForm />} />
          <Route path="/bancos/editar/:id" element={<BankEdit />} />
          <Route path="/tipos-fornecedor" element={<SupplierTypes />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
