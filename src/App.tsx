import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
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
import Payroll from "./pages/Payroll";
import ShopifyWithdrawals from "./pages/ShopifyWithdrawals";
import Banks from "./pages/Banks";
import ComparativeReport from "./pages/ComparativeReport";
import AuditLog from "./pages/AuditLog";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import GestorDashboard from "./pages/GestorDashboard";
import CaptadorDashboard from "./pages/CaptadorDashboard";
import Captadores from "./pages/Captadores";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 minutos
      gcTime: 1000 * 60 * 10,     // 10 minutos
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="profit-pilot-theme">
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            {/* gestor redirect handled by ProtectedRoute */}
            <Route path="/auth" element={<Auth />} />
            
            <Route
              element={
                <ProtectedRoute>
                  <ErrorBoundary><AppLayout /></ErrorBoundary>
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={
                <ProtectedRoute allowedRoles={['admin', 'socio']}>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/gestor-dashboard" element={
                <ProtectedRoute allowedRoles={['gestor']}>
                  <GestorDashboard />
                </ProtectedRoute>
              } />
              <Route path="/captador-dashboard" element={
                <ProtectedRoute allowedRoles={['captador']}>
                  <CaptadorDashboard />
                </ProtectedRoute>
              } />
              <Route path="/captadores" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Captadores />
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
                  <ProtectedRoute>
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
                  <ProtectedRoute allowedRoles={['admin', 'financeiro', 'socio', 'gestor']}>
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
                  <ProtectedRoute allowedRoles={['admin']}>
                    <PartnerDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payroll"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'financeiro', 'socio']}>
                    <Payroll />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/shopify-withdrawals"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'financeiro', 'socio']}>
                    <ShopifyWithdrawals />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/banks"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'financeiro', 'socio']}>
                    <Banks />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/comparative-report"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'financeiro', 'socio']}>
                    <ComparativeReport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit-log"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AuditLog />
                  </ProtectedRoute>
                }
              />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
