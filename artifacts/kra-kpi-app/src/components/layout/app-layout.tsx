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

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const mainNav = MAIN_NAV.filter((item) => !user || item.roles.includes(user.role as typeof ALL_ROLES[number]));
  const adminNav = ADMIN_NAV.filter((item) => !user || item.roles.includes(user.role as typeof ALL_ROLES[number]));

  const RoleIcon = user ? (roleIcons[user.role] ?? UserCircle) : UserCircle;
  const isAdmin = user?.role === "admin";

  return (
    <Sidebar className={`border-r border-border bg-sidebar text-sidebar-foreground ${isAdmin ? "border-r-red-200 dark:border-r-red-900/30" : ""}`}>
      <SidebarHeader className="px-3 py-2.5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 bg-white rounded-md overflow-hidden shadow-sm">
            <img
              src="/logo.png"
              alt="RPS Group"
              className="h-9 w-auto object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[11px] font-bold leading-tight truncate ${isAdmin ? "text-red-500" : "text-primary"}`}>
              RPS INFRASTRUCTURE
            </p>
            <p className="text-[9px] text-sidebar-foreground/55 truncate leading-tight font-medium">LIMITED</p>
          </div>
          {isAdmin && <ShieldAlert className="ml-auto h-3.5 w-3.5 text-red-400 shrink-0" />}
        </div>
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
