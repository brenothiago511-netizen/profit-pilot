import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardList, Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditEntry {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  changed_fields: Record<string, any> | null;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  INSERT: { label: 'Criou', color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: Plus },
  UPDATE: { label: 'Editou', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: Pencil },
  DELETE: { label: 'Deletou', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: Trash2 },
};

const TABLE_LABELS: Record<string, string> = {
  expenses: 'Despesas',
  revenues: 'Receitas',
  daily_records: 'Registros Diários',
  profiles: 'Perfis',
  stores: 'Lojas',
  bank_accounts: 'Contas Bancárias',
  payroll: 'Folha de Pagamento',
};

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      try {
        const from = (page - 1) * PAGE_SIZE;
        const { data, count, error } = await supabase
          .from('audit_logs_view' as any)
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        setLogs((data as any[]) || []);
        setTotal(count || 0);
      } catch (err) {
        console.error('Error fetching audit logs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [page]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold">Log de Auditoria</h1>
            <p className="text-sm text-muted-foreground">{total} registros encontrados</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Alterações</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {logs.map((log) => {
                  const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.UPDATE;
                  const Icon = config.icon;
                  return (
                    <div key={log.id} className="flex items-start gap-3 rounded-lg border bg-card/50 p-3 text-sm">
                      <Badge variant="outline" className={`shrink-0 gap-1 ${config.color}`}>
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {config.label}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{log.user_name || log.user_email || 'Sistema'}</span>
                        <span className="text-muted-foreground"> em </span>
                        <span className="font-medium">{TABLE_LABELS[log.table_name] || log.table_name}</span>
                        {log.changed_fields && Object.keys(log.changed_fields).length > 0 && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Campos: {Object.keys(log.changed_fields).join(', ')}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  );
                })}
                {logs.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">Nenhum registro de auditoria encontrado</p>
                )}
              </div>
            </ScrollArea>
          )}

          {total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Página {page} de {Math.ceil(total / PAGE_SIZE)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(total / PAGE_SIZE)}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
