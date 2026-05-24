import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import Dashboard from "@/pages/dashboard";
// Departments page removed — managed via System Admin > Masters tab
import Employees from "@/pages/employees";
import Tasks from "@/pages/tasks";
import KRAs from "@/pages/kras";
import KPIs from "@/pages/kpis";
import Admin from "@/pages/admin";
import Reports from "@/pages/reports";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import { ForceChangePassword } from "@/components/force-change-password";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const isAdmin = (role: string) => role === "admin";
const isManagement = (role: string) => role === "admin" || role === "management";
const isHodOrAbove = (role: string) => role === "admin" || role === "management" || role === "hod";
const isManagerOrAbove = (role: string) => role === "admin" || role === "management" || role === "hod" || role === "manager";

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.mustChangePassword) {
    return <ForceChangePassword />;
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        {isManagerOrAbove(user.role) && (
          <Route path="/employees" component={Employees} />
        )}
        <Route path="/tasks" component={Tasks} />
        <Route path="/kras" component={KRAs} />
        {isManagerOrAbove(user.role) && (
          <Route path="/kpis" component={KPIs} />
        )}
        {isManagerOrAbove(user.role) && (
          <Route path="/reports" component={Reports} />
        )}
        {isAdmin(user.role) && (
          <Route path="/admin" component={Admin} />
        )}
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function PublicRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  return <Login />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={PublicRoute} />
      <Route component={ProtectedRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
