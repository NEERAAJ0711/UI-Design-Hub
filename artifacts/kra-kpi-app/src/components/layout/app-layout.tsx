import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Building2,
  Users,
  CheckSquare,
  Target,
  BarChart,
  LogOut,
  Shield,
  UserCheck,
  Briefcase,
  UserCircle,
  ShieldAlert,
  Settings,
  FileBarChart,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/auth-context";

const ALL_ROLES = ["admin", "management", "hod", "manager", "employee"] as const;

const roleIcons: Record<string, React.ElementType> = {
  admin: ShieldAlert,
  management: Shield,
  hod: UserCheck,
  manager: Briefcase,
  employee: UserCircle,
};

const roleLabels: Record<string, string> = {
  admin: "System Admin",
  management: "Management",
  hod: "Head of Department",
  manager: "Manager",
  employee: "Employee",
};

const roleColors: Record<string, string> = {
  admin: "text-red-400",
  management: "text-purple-400",
  hod: "text-blue-400",
  manager: "text-green-400",
  employee: "text-gray-400",
};

const MAIN_NAV = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ALL_ROLES },
  { name: "Employees", href: "/employees", icon: Users, roles: ["admin", "management", "hod", "manager"] },
  { name: "Tasks", href: "/tasks", icon: CheckSquare, roles: ALL_ROLES },
  { name: "KRAs", href: "/kras", icon: Target, roles: ALL_ROLES },
  { name: "KPIs", href: "/kpis", icon: BarChart, roles: ["admin", "management", "hod", "manager"] },
  { name: "Reports", href: "/reports", icon: FileBarChart, roles: ["admin", "management", "hod", "manager"] },
];

const ADMIN_NAV = [
  { name: "System Admin", href: "/admin", icon: Settings, roles: ["admin"] },
];

function RpsLogoSidebar({ isAdmin }: { isAdmin: boolean }) {
  const blue = isAdmin ? "#ef4444" : "#1e3a70";
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      {/* Arch mark SVG — matches RPS logo icon */}
      <svg
        viewBox="0 0 56 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-9 w-auto flex-shrink-0"
        aria-hidden="true"
      >
        {/* Outer arch */}
        <path
          d="M4 56 L4 30 Q4 4 28 4 Q52 4 52 30 L52 56"
          stroke="#9ca3af"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Middle arch */}
        <path
          d="M13 56 L13 33 Q13 14 28 14 Q43 14 43 33 L43 56"
          stroke="#9ca3af"
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Inner arch */}
        <path
          d="M22 56 L22 37 Q22 24 28 24 Q34 24 34 37 L34 56"
          stroke="#9ca3af"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        {/* Cross-brace top-left */}
        <line x1="9" y1="17" x2="22" y2="10" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round" />
        {/* Cross-brace top-right */}
        <line x1="47" y1="17" x2="34" y2="10" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round" />
      </svg>

      {/* Wordmark */}
      <div className="min-w-0 flex-1 leading-none">
        <div className="flex items-baseline gap-1">
          <span
            className="text-xl font-black tracking-tight"
            style={{ color: blue, fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: "-0.02em" }}
          >
            RPS
          </span>
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
            GROUP
          </span>
        </div>
        <div className="flex items-center gap-1 mt-[1px]">
          <div className="h-px flex-1 bg-slate-300 dark:bg-slate-600" />
          <span className="text-[8.5px] font-semibold text-slate-400 dark:text-slate-500 tracking-[0.12em] uppercase whitespace-nowrap">
            Infrastructure Ltd
          </span>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const mainNav = MAIN_NAV.filter((item) => !user || item.roles.includes(user.role as typeof ALL_ROLES[number]));
  const adminNav = ADMIN_NAV.filter((item) => !user || item.roles.includes(user.role as typeof ALL_ROLES[number]));

  const RoleIcon = user ? (roleIcons[user.role] ?? UserCircle) : UserCircle;
  const isAdmin = user?.role === "admin";

  return (
    <Sidebar className={`border-r border-border bg-sidebar text-sidebar-foreground ${isAdmin ? "border-r-red-200 dark:border-r-red-900/30" : ""}`}>
      <SidebarHeader className="px-3 py-2 border-b border-sidebar-border">
        <RpsLogoSidebar isAdmin={isAdmin} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.href}
                    tooltip={item.name}
                  >
                    <Link href={item.href} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminNav.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="text-red-400">Administration</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNav.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.href}
                        tooltip={item.name}
                      >
                        <Link href={item.href} className="flex items-center gap-3 text-red-400 hover:text-red-300">
                          <item.icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        {user && (
          <div className={`px-3 py-2 mb-1 rounded-lg ${isAdmin ? "bg-red-950/30 border border-red-900/30" : "bg-sidebar-accent/50"}`}>
            <div className="flex items-center gap-2.5">
              <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${isAdmin ? "bg-red-500/20" : "bg-primary/20"}`}>
                <RoleIcon className={`h-4 w-4 ${roleColors[user.role] ?? "text-gray-400"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">{user.name}</p>
                <p className={`text-xs truncate ${roleColors[user.role] ?? "text-gray-400"}`}>
                  {roleLabels[user.role] ?? user.role}
                  {user.departmentName && !isAdmin ? ` · ${user.departmentName}` : ""}
                </p>
              </div>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
