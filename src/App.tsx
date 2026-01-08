import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Revenues from "./pages/Revenues";
import Expenses from "./pages/Expenses";
import Stores from "./pages/Stores";
import Commissions from "./pages/Commissions";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Partners from "./pages/Partners";
import CurrencySettings from "./pages/CurrencySettings";
import Goals from "./pages/Goals";
import ExecutiveReport from "./pages/ExecutiveReport";
import PartnerDashboardPage from "./pages/PartnerDashboardPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={
                <ProtectedRoute allowedRoles={['admin', 'socio']}>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route
                path="/revenues"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'financeiro', 'socio']}>
                    <Revenues />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/expenses"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'financeiro', 'socio']}>
                    <Expenses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/stores"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'socio']}>
                    <Stores />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Users />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/partners"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'socio']}>
                    <Partners />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/commissions"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'financeiro', 'socio']}>
                    <Commissions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'financeiro', 'socio']}>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/currencies"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <CurrencySettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/goals"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'financeiro', 'socio']}>
                    <Goals />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/executive-report"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'financeiro', 'socio']}>
                    <ExecutiveReport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-dashboard"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'socio']}>
                    <PartnerDashboardPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
