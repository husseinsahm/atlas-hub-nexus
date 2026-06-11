import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "next-themes";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AcceptInvite from "./pages/AcceptInvite";
import { DashboardLayout } from "./components/layouts/DashboardLayout";
import { AdminLayout } from "./components/layouts/AdminLayout";
import Overview from "./pages/dashboard/Overview";
import PlaceholderPage from "./pages/dashboard/PlaceholderPage";
import CompaniesPage from "./pages/dashboard/CompaniesPage";
import PlansPage from "./pages/dashboard/PlansPage";
import SubscriptionsPage from "./pages/dashboard/SubscriptionsPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import TeamPage from "./pages/dashboard/TeamPage";
import LeadsPage from "./pages/dashboard/LeadsPage";
import LeadDetailPage from "./pages/dashboard/LeadDetailPage";
import CustomersPage from "./pages/dashboard/CustomersPage";
import CustomerDetailPage from "./pages/dashboard/CustomerDetailPage";
import LibraryPage from "./pages/dashboard/LibraryPage";
import TemplatesPage from "./pages/dashboard/TemplatesPage";
import TemplateDetailPage from "./pages/dashboard/TemplateDetailPage";
import BookingsPage from "./pages/dashboard/BookingsPage";
import BookingDetailPage from "./pages/dashboard/BookingDetailPage";
import QuotationsPage from "./pages/dashboard/QuotationsPage";
import InvoicesPage from "./pages/dashboard/InvoicesPage";
import InvoiceDetailPage from "./pages/dashboard/InvoiceDetailPage";
import QuotationDetailPage from "./pages/dashboard/QuotationDetailPage";
import OperationsPage from "./pages/dashboard/OperationsPage";
import FleetPage from "./pages/dashboard/FleetPage";
import DispatchPage from "./pages/dashboard/DispatchPage";
import FleetReportsPage from "./pages/dashboard/FleetReportsPage";
import SharedTrip from "./pages/shared/SharedTrip";
import SharedBooking from "./pages/shared/SharedBooking";
import DriverPortal from "./pages/shared/DriverPortal";
import AnalyticsPage from "./pages/dashboard/AnalyticsPage";
import BillingPage from "./pages/dashboard/BillingPage";
import TasksPage from "./pages/dashboard/TasksPage";
import AutomationsPage from "./pages/dashboard/AutomationsPage";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminOverview from "./pages/admin/AdminOverview";
import PlanManagement from "./pages/admin/PlanManagement";
import SubscriptionManagement from "./pages/admin/SubscriptionManagement";
import RevenueDashboard from "./pages/admin/RevenueDashboard";
import GlobalSettings from "./pages/admin/GlobalSettings";

import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
      <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />
      <Route path="/forgot-password" element={<AuthRoute><ForgotPassword /></AuthRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />

      {/* Shared trip - public, token-based */}
      <Route path="/trip/:token" element={<SharedTrip />} />
      <Route path="/booking/:token" element={<SharedBooking />} />
      <Route path="/driver/:token" element={<DriverPortal />} />

      {/* Super Admin Panel */}
      <Route path="/admin" element={<SuperAdminRoute><AdminLayout /></SuperAdminRoute>}>
        <Route index element={<AdminOverview />} />
        <Route path="plans" element={<PlanManagement />} />
        <Route path="subscriptions" element={<SubscriptionManagement />} />
        <Route path="revenue" element={<RevenueDashboard />} />
        <Route path="settings" element={<GlobalSettings />} />
      </Route>

      {/* Dashboard - protected */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<Overview />} />
        
        {/* Super Admin */}
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        
        {/* Sales & CRM */}
        <Route path="clients" element={<LeadsPage />} />
        <Route path="leads/:id" element={<LeadDetailPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="tasks" element={<TasksPage />} />
        
        {/* Main entity: Booking Files */}
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="bookings/:id" element={<BookingDetailPage />} />
        
        {/* Operations */}
        <Route path="operations" element={<OperationsPage />} />
        <Route path="fleet" element={<FleetPage />} />
        <Route path="dispatch" element={<DispatchPage />} />
        <Route path="fleet-reports" element={<FleetReportsPage />} />
        
        {/* Product Management */}
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="templates/:id" element={<TemplateDetailPage />} />
        <Route path="library" element={<LibraryPage />} />
        
        {/* Finance */}
        <Route path="quotations" element={<QuotationsPage />} />
        <Route path="quotations/:id" element={<QuotationDetailPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/:id" element={<InvoiceDetailPage />} />
        
        {/* Analytics & Reports */}
        <Route path="analytics" element={<AnalyticsPage />} />
        
        {/* Team & Settings */}
        <Route path="staff" element={<TeamPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="automations" element={<AutomationsPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="atlas-theme">
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
