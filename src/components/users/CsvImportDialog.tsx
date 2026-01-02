import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, FileText, Download, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

type AppRole = 'admin' | 'financeiro' | 'gestor' | 'socio';

interface ParsedUser {
  email: string;
  name: string;
  password: string;
  role: AppRole;
  valid: boolean;
  error?: string;
}

interface ImportResult {
  email: string;
  success: boolean;
  error?: string;
}

interface CsvImportDialogProps {
  onImportComplete: () => void;
}

export function CsvImportDialog({ onImportComplete }: CsvImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'results'>('upload');
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const downloadTemplate = () => {
    const csvContent = 'email,nome,senha,papel\nexemplo@email.com,Nome Completo,senha123,financeiro\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_usuarios.csv';
    link.click();
  };

  const parseCSV = (content: string): ParsedUser[] => {
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return [];
    }

    // Skip header row
    const dataLines = lines.slice(1);
    const validRoles: AppRole[] = ['admin', 'financeiro', 'gestor', 'socio'];

    return dataLines.map(line => {
      // Handle CSV with possible quoted values
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const [email, name, password, roleRaw] = values;
      const role = (roleRaw?.toLowerCase() as AppRole) || 'financeiro';
      
      let valid = true;
      let error: string | undefined;

      if (!email || !email.includes('@')) {
        valid = false;
        error = 'Email inválido';
      } else if (!name || name.length < 2) {
        valid = false;
        error = 'Nome inválido';
      } else if (!password || password.length < 6) {
        valid = false;
        error = 'Senha deve ter 6+ caracteres';
      } else if (!validRoles.includes(role)) {
        valid = false;
        error = 'Papel inválido (admin, financeiro, gestor, socio)';
      }

      return {
        email: email || '',
        name: name || '',
        password: password || '',
        role: validRoles.includes(role) ? role : 'financeiro',
        valid,
        error,
      };
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione um arquivo CSV',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const users = parseCSV(content);
      
      if (users.length === 0) {
        toast({
          title: 'Erro',
          description: 'Nenhum usuário encontrado no arquivo',
          variant: 'destructive',
        });
        return;
      }

      setParsedUsers(users);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validUsers = parsedUsers.filter(u => u.valid);
    
    if (validUsers.length === 0) {
      toast({
        title: 'Erro',
        description: 'Nenhum usuário válido para importar',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    setStep('importing');
    setProgress(10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada');
      }

      setProgress(30);

      const response = await supabase.functions.invoke('bulk-import-users', {
        body: {
          users: validUsers.map(u => ({
            email: u.email,
            name: u.name,
            password: u.password,
            role: u.role,
          })),
        },
      });

      setProgress(90);

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      setImportResults(data.results || []);
      setProgress(100);
      setStep('results');

      toast({
        title: 'Importação concluída',
        description: `${data.summary.success} usuários criados, ${data.summary.failed} falhas`,
      });

      if (data.summary.success > 0) {
        onImportComplete();
      }

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Erro na importação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const resetDialog = () => {
    setStep('upload');
    setParsedUsers([]);
    setImportResults([]);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetDialog();
    }
  };

  const validCount = parsedUsers.filter(u => u.valid).length;
  const invalidCount = parsedUsers.filter(u => !u.valid).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Usuários via CSV</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Selecione um arquivo CSV com as colunas: email, nome, senha, papel
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" asChild>
                  <span className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Selecionar Arquivo
                  </span>
                </Button>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Baixe o modelo para ver o formato esperado
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Baixar Modelo
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="default">{validCount} válidos</Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive">{invalidCount} com erro</Badge>
              )}
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Nome</th>
                    <th className="p-2 text-left">Papel</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedUsers.map((user, idx) => (
                    <tr key={idx} className={user.valid ? '' : 'bg-destructive/10'}>
                      <td className="p-2">
                        {user.valid ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="w-4 h-4" />
                            <span className="text-xs">{user.error}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-2">{user.email}</td>
                      <td className="p-2">{user.name}</td>
                      <td className="p-2">{user.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={resetDialog}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                Importar {validCount} Usuários
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Importando usuários...</p>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {step === 'results' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="default">
                {importResults.filter(r => r.success).length} criados
              </Badge>
              {importResults.filter(r => !r.success).length > 0 && (
                <Badge variant="destructive">
                  {importResults.filter(r => !r.success).length} falhas
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {importResults.map((result, idx) => (
                    <tr key={idx} className={result.success ? '' : 'bg-destructive/10'}>
                      <td className="p-2">
                        {result.success ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                      </td>
                      <td className="p-2">{result.email}</td>
                      <td className="p-2 text-muted-foreground">
                        {result.success ? 'Criado com sucesso' : result.error}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <div className="flex justify-end">
              <Button onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
