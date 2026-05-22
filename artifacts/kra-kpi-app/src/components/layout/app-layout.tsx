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
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/auth-context";

const roleIcons: Record<string, React.ElementType> = {
  management: Shield,
  hod: UserCheck,
  manager: Briefcase,
  employee: UserCircle,
};

const roleLabels: Record<string, string> = {
  management: "Management",
  hod: "Head of Department",
  manager: "Manager",
  employee: "Employee",
};

const roleColors: Record<string, string> = {
  management: "text-purple-400",
  hod: "text-blue-400",
  manager: "text-green-400",
  employee: "text-gray-400",
};

const ALL_NAV = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["management", "hod", "manager", "employee"] },
  { name: "Departments", href: "/departments", icon: Building2, roles: ["management", "hod"] },
  { name: "Employees", href: "/employees", icon: Users, roles: ["management", "hod", "manager"] },
  { name: "Tasks", href: "/tasks", icon: CheckSquare, roles: ["management", "hod", "manager", "employee"] },
  { name: "KRAs", href: "/kras", icon: Target, roles: ["management", "hod", "manager", "employee"] },
  { name: "KPIs", href: "/kpis", icon: BarChart, roles: ["management", "hod", "manager"] },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navigation = ALL_NAV.filter(
    (item) => !user || item.roles.includes(user.role)
  );

  const RoleIcon = user ? (roleIcons[user.role] ?? UserCircle) : UserCircle;

  return (
    <Sidebar className="border-r border-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="flex h-14 items-center px-4 font-bold text-xl tracking-tight text-primary">
        Command<span className="text-sidebar-foreground">Center</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
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
      </SidebarContent>
      <SidebarFooter>
        {user && (
          <div className="px-3 py-2 mb-1 rounded-lg bg-sidebar-accent/50">
            <div className="flex items-center gap-2.5">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <RoleIcon className={`h-4 w-4 ${roleColors[user.role] ?? "text-gray-400"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">{user.name}</p>
                <p className={`text-xs truncate ${roleColors[user.role] ?? "text-gray-400"}`}>
                  {roleLabels[user.role] ?? user.role} · {user.departmentName}
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
