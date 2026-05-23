import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, ShieldAlert } from "lucide-react";

const DEMO_ACCOUNTS = [
  { role: "System Admin", email: "admin@company.com", label: "System Admin", isAdmin: true },
  { role: "Management", email: "rajan.mehta@company.com", label: "Rajan Mehta", isAdmin: false },
  { role: "HOD (HR)", email: "priya.sharma@company.com", label: "Priya Sharma", isAdmin: false },
  { role: "HOD (IT)", email: "anil.kumar@company.com", label: "Anil Kumar", isAdmin: false },
  { role: "Manager", email: "sunita.verma@company.com", label: "Sunita Verma", isAdmin: false },
  { role: "Employee", email: "kavita.joshi@company.com", label: "Kavita Joshi", isAdmin: false },
];

export default function Login() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim(), password);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("Password@123");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-blue-950/20 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">

        {/* Brand / Logo */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md px-6 py-4 inline-flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <img
                src="/logo.png"
                alt="RPS Group"
                className="h-16 w-auto object-contain"
              />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              RPS INFRASTRUCTURE LIMITED
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              KRA, KPI &amp; Task Management System
            </p>
          </div>
        </div>

        {/* Login card */}
        <Card className="shadow-xl border-border">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Enter your work email and password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  data-testid="input-login-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  data-testid="input-login-password"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-blue-700 hover:bg-blue-800 text-white"
                disabled={loading}
                data-testid="button-login-submit"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo quick-fill */}
        <Card className="border-dashed border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Demo accounts — click to fill
            </CardTitle>
            <CardDescription className="text-xs">
              All accounts use password: <code className="bg-muted px-1 rounded text-foreground font-mono">Password@123</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc.email)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors group text-left ${acc.isAdmin ? "border border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20" : ""}`}
                  data-testid={`button-demo-${acc.role.toLowerCase().replace(/[\s()]/g, "-")}`}
                >
                  <div className="flex items-center gap-2">
                    {acc.isAdmin && <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <span className={`font-medium ${acc.isAdmin ? "text-red-700 dark:text-red-400" : ""}`}>{acc.label}</span>
                  </div>
                  <span className={`text-xs group-hover:text-foreground transition-colors ${acc.isAdmin ? "text-red-500 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
                    {acc.role}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600">
          © {new Date().getFullYear()} RPS Infrastructure Limited. All rights reserved.
        </p>
      </div>
    </div>
  );
}
