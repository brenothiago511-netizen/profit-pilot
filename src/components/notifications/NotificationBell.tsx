import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, AlertTriangle, Target, Info, Check, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  metadata: any;
  created_at: string;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      checkAndGenerateAlerts();
    }
  }, [user]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(20);

    setNotifications(data || []);
  };

  const checkAndGenerateAlerts = async () => {
    if (!user) return;

    // Check expenses vs previous month
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const [currentExpenses, prevExpenses, goals] = await Promise.all([
      supabase.from('expenses').select('amount').gte('date', currentMonthStart).lte('date', currentMonthEnd),
      supabase.from('expenses').select('amount').gte('date', prevMonthStart).lte('date', prevMonthEnd),
      supabase.from('revenue_goals').select('*, partners(user_id)').gte('period_end', currentMonthStart).lte('period_start', currentMonthEnd),
    ]);

    const currentTotal = (currentExpenses.data || []).reduce((s, e) => s + Number(e.amount), 0);
    const prevTotal = (prevExpenses.data || []).reduce((s, e) => s + Number(e.amount), 0);

    // Check if already notified today
    const today = now.toISOString().split('T')[0];
    const { data: todayNotifs } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', today + 'T00:00:00')
      .limit(1);

    if ((todayNotifs || []).length > 0) return; // Already generated today

    const newNotifs: Array<{ user_id: string; title: string; message: string; type: string; metadata: any }> = [];

    // Alert: expenses increased >20%
    if (prevTotal > 0 && currentTotal > prevTotal * 1.2) {
      const increase = ((currentTotal - prevTotal) / prevTotal * 100).toFixed(0);
      newNotifs.push({
        user_id: user.id,
        title: 'Despesas acima do esperado',
        message: `As despesas deste mês aumentaram ${increase}% em relação ao mês anterior.`,
        type: 'warning',
        metadata: { currentTotal, prevTotal, increase },
      });
    }

    // Alert: goals at risk (past 50% of period but less than 40% progress)
    if (goals.data) {
      for (const goal of goals.data) {
        const partner = goal.partners as any;
        if (partner?.user_id !== user.id) continue;

        const start = new Date(goal.period_start).getTime();
        const end = new Date(goal.period_end).getTime();
        const elapsed = (now.getTime() - start) / (end - start);

        if (elapsed > 0.5) {
          newNotifs.push({
            user_id: user.id,
            title: 'Meta pode não ser atingida',
            message: `A meta de ${goal.goal_currency} ${goal.goal_amount_original.toLocaleString()} pode estar em risco. Mais da metade do período já passou.`,
            type: 'goal',
            metadata: { goal_id: goal.id },
          });
        }
      }
    }

    if (newNotifs.length > 0) {
      await supabase.from('notifications').insert(newNotifs);
      fetchNotifications();
    }
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user!.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'goal': return <Target className="w-4 h-4 text-orange-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notificações</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              <Check className="w-3 h-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={cn(
                  'flex gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors',
                  !notif.read && 'bg-primary/5'
                )}
                onClick={() => markAsRead(notif.id)}
              >
                <div className="mt-0.5">{getIcon(notif.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', !notif.read && 'font-semibold')}>{notif.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {format(new Date(notif.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
