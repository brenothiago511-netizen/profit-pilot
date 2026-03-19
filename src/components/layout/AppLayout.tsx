import { useState, useMemo } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
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
  DollarSign,
  Wallet,
  Landmark,
  Sun,
  Moon,
  BarChart3,
  Settings,
} from 'lucide-react';
import logoAglomerado from '@/assets/logo-aglomerado.png';
import NotificationBell from '@/components/notifications/NotificationBell';
import GlobalSearch from '@/components/search/GlobalSearch';

// Navigation sections with items
const navigationSections = [
  {
    title: 'Visão Geral',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permissions: ['view_dashboard', 'view_dashboard_socios'] },
      { name: 'Painel de Sócios', href: '/my-dashboard', icon: Building2, permissions: ['manage_partners'], adminOnly: true },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { name: 'Receitas', href: '/revenues', icon: TrendingUp, permissions: ['create_revenue', 'edit_revenue'] },
      { name: 'Despesas', href: '/expenses', icon: TrendingDown, permissions: ['create_expense', 'edit_expense'] },
      { name: 'Bancos', href: '/banks', icon: Landmark, permissions: ['create_revenue', 'edit_revenue', 'view_revenues'] },
      { name: 'Metas', href: '/goals', icon: Target, permissions: ['manage_goals', 'view_reports'] },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { name: 'Lojas', href: '/stores', icon: Store, permissions: ['manage_stores'] },
      { name: 'Usuários', href: '/users', icon: UserCog, permissions: ['manage_users'] },
      { name: 'Sócios', href: '/partners', icon: Handshake, permissions: ['manage_partners'], adminOnly: true },
    ],
  },
  {
    title: 'Lucros',
    items: [
      { name: 'Lucros', href: '/commissions', icon: DollarSign, permissions: ['view_profits', 'register_profits'] },
      { name: 'Saques Shopify', href: '/shopify-withdrawals', icon: Wallet, permissions: ['view_profits', 'register_profits', 'view_shopify_withdrawals'] },
    ],
  },
  {
    title: 'Relatórios',
    items: [
      { name: 'Relatórios', href: '/reports', icon: FileText, permissions: ['view_reports'] },
      { name: 'Relatório Executivo', href: '/executive-report', icon: ClipboardList, permissions: ['view_reports', 'export_reports'] },
      { name: 'Comparativo', href: '/comparative-report', icon: BarChart3, permissions: [] },
    ],
  },
  {
    title: 'Administração',
    items: [
      { name: 'Folha de Pagamento', href: '/payroll', icon: Wallet },
      { name: 'Auditoria', href: '/audit-log', icon: ClipboardList, permissions: [], adminOnly: true },
    ],
  },
  {
    title: 'Configurações',
    items: [
      { name: 'Moedas', href: '/settings/currencies', icon: Coins, permissions: ['manage_currency_rates'] },
    ],
  },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, signOut, isAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Filter navigation sections based on permissions
  const filteredSections = useMemo(() => {
    return navigationSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          // Check if item is admin-only
          if ((item as any).adminOnly && !isAdmin) {
            return false;
          }
          const perms = (item as any).permissions;
          if (!perms || perms.length === 0) return true;
          return perms.some((perm: string) => hasPermission(perm));
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [hasPermission, isAdmin]);
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
      socio: 'Sócio',
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
            <img 
              src={logoAglomerado} 
              alt="Aglomerado" 
              className="h-8 w-auto"
            />
            <button
              className="ml-auto lg:hidden text-sidebar-foreground"
              onClick={() => setSidebarOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Navigation */}
          <nav role="navigation" aria-label="Menu principal" className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
            {filteredSections.map((section) => (
              <div key={section.title}>
                <p className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => (
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
                </div>
              </div>
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
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="h-4 w-4" aria-hidden="true" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
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
            aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
          <div className="flex-1 flex justify-center px-2">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-9 w-9"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              aria-label={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <NotificationBell />
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
