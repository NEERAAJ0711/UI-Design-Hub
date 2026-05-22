import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import Dashboard from "@/pages/dashboard";
import Departments from "@/pages/departments";
import Employees from "@/pages/employees";
import Tasks from "@/pages/tasks";
import KRAs from "@/pages/kras";
import KPIs from "@/pages/kpis";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

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

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        {(user.role === "management" || user.role === "hod") && (
          <Route path="/departments" component={Departments} />
        )}
        {(user.role === "management" || user.role === "hod" || user.role === "manager") && (
          <Route path="/employees" component={Employees} />
        )}
        <Route path="/tasks" component={Tasks} />
        <Route path="/kras" component={KRAs} />
        {(user.role === "management" || user.role === "hod" || user.role === "manager") && (
          <Route path="/kpis" component={KPIs} />
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
