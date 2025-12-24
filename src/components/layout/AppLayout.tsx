import { useState, useMemo } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Store,
  Users,
  UserCog,
  Percent,
  FileText,
  Menu,
  X,
  LogOut,
  Building2,
  ChevronDown,
  Handshake,
  Coins,
  Target,
  ClipboardList,
} from 'lucide-react';

// Navigation items with required permissions
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permissions: ['view_dashboard', 'view_dashboard_socios'] },
  { name: 'Meu Painel', href: '/my-dashboard', icon: Building2, permissions: ['view_partner_results'] },
  { name: 'Receitas', href: '/revenues', icon: TrendingUp, permissions: ['create_revenue', 'edit_revenue'] },
  { name: 'Despesas', href: '/expenses', icon: TrendingDown, permissions: ['create_expense', 'edit_expense'] },
  { name: 'Metas', href: '/goals', icon: Target, permissions: ['manage_goals', 'view_reports'] },
  { name: 'Lojas', href: '/stores', icon: Store, permissions: ['manage_stores'] },
  { name: 'Usuários', href: '/users', icon: UserCog, permissions: ['manage_users'] },
  { name: 'Gestores', href: '/managers', icon: Users, permissions: ['manage_commissions'] },
  { name: 'Sócios', href: '/partners', icon: Handshake, permissions: ['manage_partners'] },
  { name: 'Comissões', href: '/commissions', icon: Percent, permissions: ['view_commissions', 'manage_commissions'] },
  { name: 'Relatórios', href: '/reports', icon: FileText, permissions: ['view_reports'] },
  { name: 'Relatório Executivo', href: '/executive-report', icon: ClipboardList, permissions: ['view_reports', 'export_reports'] },
  { name: 'Moedas', href: '/settings/currencies', icon: Coins, permissions: ['manage_currency_rates'] },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Filter navigation based on permissions
  const filteredNavigation = useMemo(() => {
    return navigation.filter((item) => {
      // Check if user has any of the required permissions
      return item.permissions.some((perm) => hasPermission(perm));
    });
  }, [hasPermission]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleName = (role: string) => {
    const roles: Record<string, string> = {
      admin: 'Administrador',
      financeiro: 'Financeiro',
      gestor: 'Gestor',
    };
    return roles[role] || role;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sidebar-primary">
              <Building2 className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-sidebar-foreground">FinControl</span>
            <button
              className="ml-auto lg:hidden text-sidebar-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* User menu */}
          <div className="p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2.5 h-auto text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                      {profile ? getInitials(profile.name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium truncate">{profile?.name}</p>
                    <p className="text-xs text-sidebar-foreground/60">{profile && getRoleName(profile.role)}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
          <button
            className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
