import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutDashboard, TrendingUp, TrendingDown, Store, UserCog, Handshake, DollarSign, FileText, ClipboardList, Target, Wallet, Landmark, Coins, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';

const pages = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permissions: ['view_dashboard', 'view_dashboard_socios'] },
  { name: 'Painel de Sócios', href: '/my-dashboard', icon: Building2, permissions: ['manage_partners'] },
  { name: 'Receitas', href: '/revenues', icon: TrendingUp, permissions: ['create_revenue', 'view_revenues'] },
  { name: 'Despesas', href: '/expenses', icon: TrendingDown, permissions: ['create_expense', 'view_expenses'] },
  { name: 'Bancos', href: '/banks', icon: Landmark, permissions: ['create_revenue', 'view_revenues'] },
  { name: 'Metas', href: '/goals', icon: Target, permissions: ['manage_goals', 'view_reports'] },
  { name: 'Lojas', href: '/stores', icon: Store, permissions: ['manage_stores'] },
  { name: 'Usuários', href: '/users', icon: UserCog, permissions: ['manage_users'] },
  { name: 'Sócios', href: '/partners', icon: Handshake, permissions: ['manage_partners'] },
  { name: 'Lucros', href: '/commissions', icon: DollarSign, permissions: ['view_profits', 'register_profits'] },
  { name: 'Saques Shopify', href: '/shopify-withdrawals', icon: Wallet, permissions: ['view_profits'] },
  { name: 'Relatórios', href: '/reports', icon: FileText, permissions: ['view_reports'] },
  { name: 'Relatório Executivo', href: '/executive-report', icon: ClipboardList, permissions: ['view_reports'] },
  { name: 'Folha de Pagamento', href: '/payroll', icon: Wallet },
  { name: 'Moedas', href: '/settings/currencies', icon: Coins, permissions: ['manage_currency_rates'] },
];

interface StoreResult {
  id: string;
  name: string;
  country: string;
  currency: string;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [stores, setStores] = useState<StoreResult[]>([]);
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { isAdmin } = useAuth();

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Load stores when dialog opens
  useEffect(() => {
    if (!open) return;
    const fetchStores = async () => {
      const { data } = await supabase
        .from('stores')
        .select('id, name, country, currency')
        .eq('status', 'active')
        .order('name')
        .limit(50);
      if (data) setStores(data);
    };
    fetchStores();
  }, [open]);

  const filteredPages = pages.filter((page) => {
    if (!page.permissions || page.permissions.length === 0) return true;
    return page.permissions.some((p) => hasPermission(p));
  });

  const goTo = useCallback((path: string) => {
    setOpen(false);
    navigate(path);
  }, [navigate]);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="relative h-9 w-9 p-0 xl:h-9 xl:w-60 xl:justify-start xl:px-3 xl:py-2"
      >
        <Search className="h-4 w-4 xl:mr-2" />
        <span className="hidden xl:inline-flex text-muted-foreground text-sm">Buscar...</span>
        <kbd className="pointer-events-none hidden xl:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground ml-auto">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar páginas, lojas..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          
          <CommandGroup heading="Páginas">
            {filteredPages.map((page) => (
              <CommandItem
                key={page.href}
                value={page.name}
                onSelect={() => goTo(page.href)}
              >
                <page.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                {page.name}
              </CommandItem>
            ))}
          </CommandGroup>

          {stores.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Lojas">
                {stores.map((store) => (
                  <CommandItem
                    key={store.id}
                    value={`${store.name} ${store.country}`}
                    onSelect={() => goTo('/stores')}
                  >
                    <Store className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{store.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {store.country} · {store.currency}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
