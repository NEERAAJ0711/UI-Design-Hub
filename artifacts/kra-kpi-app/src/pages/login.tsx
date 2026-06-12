import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, ShieldAlert, Building2, Users, BarChart3, Target } from "lucide-react";

const DEMO_ACCOUNTS = [
  { role: "Management", email: "admin@rpsgroup.com", label: "Admin User", isAdmin: false },
  { role: "HOD Engineering", email: "hod.engineering@rpsgroup.com", label: "Priya Sharma", isAdmin: false },
  { role: "Manager", email: "manager.eng@rpsgroup.com", label: "Rahul Verma", isAdmin: false },
  { role: "Employee", email: "employee@rpsgroup.com", label: "Amit Kumar", isAdmin: false },
  { role: "HOD HR", email: "hod.hr@rpsgroup.com", label: "Sunita Patel", isAdmin: false },
];

const HIGHLIGHTS = [
  { icon: Users, label: "250+ Employees", sub: "Across 11 departments" },
  { icon: Target, label: "KRA Tracking", sub: "Key Result Areas" },
  { icon: BarChart3, label: "KPI Analytics", sub: "Performance indicators" },
  { icon: Building2, label: "Multi-Dept Teams", sub: "Cross-team performance" },
];

export default function Login() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

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
    setShowDemo(false);
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL — Branding ── */}
      <div className="hidden lg:flex lg:w-[55%] flex-col bg-gradient-to-br from-[#1a2e5a] via-[#1e3a70] to-[#0f2040] relative overflow-hidden">

        {/* Decorative arch rings echoing the RPS logo icon */}
        <div className="absolute top-0 right-0 w-[520px] h-[520px] opacity-[0.06]">
          <div className="absolute inset-0 rounded-full border-[40px] border-white" style={{ top: "-20%", right: "-20%" }} />
          <div className="absolute inset-0 rounded-full border-[30px] border-white" style={{ top: "-10%", right: "-10%" }} />
          <div className="absolute inset-0 rounded-full border-[20px] border-white" style={{ top: "0%", right: "0%" }} />
        </div>
        <div className="absolute bottom-0 left-0 w-[360px] h-[360px] opacity-[0.04]">
          <div className="absolute inset-0 rounded-full border-[30px] border-white" style={{ bottom: "-20%", left: "-20%" }} />
          <div className="absolute inset-0 rounded-full border-[20px] border-white" style={{ bottom: "-10%", left: "-10%" }} />
        </div>

        <div className="relative z-10 flex flex-col h-full px-12 py-10">

          {/* Logo */}
          <div className="flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-2xl inline-block px-8 py-5">
              <img
                src="/logo.png"
                alt="RPS Group"
                className="h-20 w-auto object-contain"
                style={{ maxWidth: 320 }}
              />
            </div>
          </div>

          {/* Company Identity */}
          <div className="mt-8">
            <h1 className="text-3xl font-extrabold text-white leading-tight tracking-tight">
              RPS Infrastructure<br />
              <span className="text-blue-300">Limited</span>
            </h1>
            <p className="mt-2 text-blue-200 text-sm font-medium tracking-wide uppercase">
              Building Futuristic Infrastructure
            </p>
            <div className="mt-4 w-12 h-1 rounded-full bg-blue-400" />
          </div>

          {/* System Name */}
          <div className="mt-8">
            <p className="text-white/60 text-xs uppercase tracking-widest font-semibold mb-1">Enterprise Management Portal</p>
            <h2 className="text-2xl font-bold text-white">
              KRA &amp; KPI<br />Management System
            </h2>
            <p className="mt-3 text-blue-200/80 text-sm leading-relaxed max-w-sm">
              A centralised platform to track Key Result Areas, monitor KPIs, and measure employee performance across all departments.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="mt-10 grid grid-cols-2 gap-4">
            {HIGHLIGHTS.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-blue-300" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-tight">{label}</p>
                  <p className="text-blue-300/70 text-xs leading-tight mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-auto pt-8 border-t border-white/10">
            <p className="text-blue-300/60 text-xs">
              © {new Date().getFullYear()} RPS Infrastructure Limited. All rights reserved.
            </p>
            <p className="text-blue-300/40 text-[10px] mt-0.5">Authorised personnel only. Unauthorised access is prohibited.</p>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Login Form ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 px-6 py-10">

        {/* Mobile logo (shown only on small screens) */}
        <div className="lg:hidden mb-8 text-center">
          <div className="inline-block bg-white rounded-2xl shadow-lg px-6 py-4 border border-slate-200">
            <img src="/logo.png" alt="RPS Group" className="h-16 w-auto object-contain mx-auto" />
          </div>
          <h1 className="mt-3 text-lg font-bold text-slate-800 dark:text-slate-100">RPS INFRASTRUCTURE LIMITED</h1>
          <p className="text-xs text-slate-500">KRA, KPI &amp; Task Management System</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Welcome back</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Sign in to your account to continue
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Work Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@rpsgroup.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="h-11 text-sm bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500"
                data-testid="input-login-email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="h-11 text-sm bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                data-testid="input-login-password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-[#1e3a70] hover:bg-[#1a2e5a] text-white font-semibold text-sm rounded-lg transition-colors"
              disabled={loading}
              data-testid="button-login-submit"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</>
              ) : "Sign In"}
            </Button>
          </form>

          {/* Divider */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs text-slate-400 font-medium">Demo Accounts</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Demo accounts */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowDemo(!showDemo)}
              className="w-full text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-center flex items-center justify-center gap-1.5 py-1 transition-colors"
            >
              <span>{showDemo ? "Hide" : "Click to see"} demo accounts — all use password <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded font-mono text-slate-600 dark:text-slate-300">Password@123</code></span>
            </button>

            {showDemo && (
              <div className="mt-3 space-y-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-sm">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillDemo(acc.email)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left ${
                      acc.isAdmin ? "border border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20" : ""
                    }`}
                    data-testid={`button-demo-${acc.role.toLowerCase().replace(/[\s()]/g, "-")}`}
                  >
                    <div className="flex items-center gap-2">
                      {acc.isAdmin && <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                      <span className={`font-medium ${acc.isAdmin ? "text-red-700 dark:text-red-400" : "text-slate-700 dark:text-slate-200"}`}>
                        {acc.label}
                      </span>
                    </div>
                    <span className={`text-xs font-medium ${acc.isAdmin ? "text-red-500" : "text-slate-400"}`}>
                      {acc.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="mt-8 text-center text-[11px] text-slate-400">
            © {new Date().getFullYear()} RPS Infrastructure Limited
          </p>
        </div>
      </div>
    </div>
  );
}
