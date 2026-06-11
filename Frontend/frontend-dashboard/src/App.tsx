import { Toaster }                       from "@/components/ui/toaster";
import { Toaster as Sonner }             from "@/components/ui/sonner";
import { TooltipProvider }               from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth }         from '@/contexts/AuthContext';
import { LoginPage }           from './pages/LoginPage';

// Pages
import Dashboard       from "./pages/Dashboard";
import Teachers        from "./pages/Teachers";
import Feedback        from "./pages/Feedback";
import Issues          from "./pages/Issues";
import UploadModules   from "./pages/UploadModules";
import NotFound        from "./pages/NotFound";
import { AdminManagement } from '@/pages/AdminManagement';

const queryClient = new QueryClient();

function AppRoutes() {
  const { isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="mt-4 text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/"        element={<Dashboard  onLogout={logout} />} />
      <Route path="/teachers" element={<Teachers  onLogout={logout} />} />
      <Route path="/issues"   element={<Issues    onLogout={logout} />} />
      <Route path="/feedback" element={<Feedback  onLogout={logout} />} />
      <Route path="/modules"  element={<UploadModules />} />
      <Route path="/admins"   element={<AdminManagement onLogout={logout} />} />
      <Route path="*"         element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;