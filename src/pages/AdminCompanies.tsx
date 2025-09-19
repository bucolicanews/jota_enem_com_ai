import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Pencil, Trash2, RefreshCw } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Importa a função de verificação de permissão
import { requireAdmin, requireDevAccess } from '@/utils/permissions';

interface Company {
  id: string;
  nome: string;
  cnpj: string;
  endereco: string | null;
  ativo: boolean;
  data_inscricao: string;
  telefone: string | null;
  email: string;
}

const AdminCompanies = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isDev, setisDev] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(true);

  const [editMode, setEditMode] = useState(false);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [endereco, setEndereco] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('empresa')
      .select('*')
      .order('data_inscricao', { ascending: false });

    if (error) {
      showError('Erro ao carregar empresas.');
      console.error('Error fetching companies:', error);
    } else {
      setCompanies(data as Company[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const checkUserAndAdmin = async () => {
      setCheckingPermissions(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }
      setUser(user);

      const hasDevAccess = await requireDevAccess(user.id);

      if (!hasDevAccess) {
        showError('Acesso negado. Apenas desenvolvedores podem gerenciar empresas');
        navigate('/dashboard');
      } else {
        setisDev(true);
        fetchCompanies();
      }
      setCheckingPermissions(false);
    };
    checkUserAndAdmin();
  }, [navigate, fetchCompanies]);

  const resetForm = () => {
    setNome('');
    setCnpj('');
    setEndereco('');
    setAtivo(true);
    setTelefone('');
    setEmail('');
    setEditMode(false);
    setCurrentCompany(null);
  };

  const handleEditClick = (company: Company) => {
    setEditMode(true);
    setCurrentCompany(company);
    setNome(company.nome);
    setCnpj(company.cnpj);
    setEndereco(company.endereco || '');
    setAtivo(company.ativo);
    setTelefone(company.telefone || '');
    setEmail(company.email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isDev) {
      showError('Acesso negado.');
      return;
    }
    if (!nome || !cnpj || !email) {
      showError('Nome, CNPJ e E-mail são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    const companyData = {
      nome,
      cnpj,
      endereco: endereco || null,
      ativo,
      telefone: telefone || null,
      email,
    };

    let error = null;
    if (editMode && currentCompany) {
      const { error: updateError } = await supabase
        .from('empresa')
        .update(companyData)
        .eq('id', currentCompany.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('empresa')
        .insert(companyData);
      error = insertError;
    }

    if (error) {
      showError(`Erro ao ${editMode ? 'atualizar' : 'adicionar'} empresa: ${error.message}`);
      console.error('Submit error:', error);
    } else {
      showSuccess(`Empresa ${editMode ? 'atualizada' : 'adicionada'} com sucesso!`);
      resetForm();
      fetchCompanies();
    }
    setIsSubmitting(false);
  };

  const handleResetPassword = async (email: string) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        showError(`Erro ao enviar o e-mail de redefinição de senha: ${error.message}`);
      } else {
        showSuccess('E-mail de redefinição de senha enviado com sucesso!');
      }
    } catch (error) {
      showError('Erro ao enviar o e-mail de redefinição de senha.');
      console.error('Reset password error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !isDev) {
      showError('Acesso negado.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja deletar esta empresa?')) return;

    const { error } = await supabase
      .from('empresa')
      .delete()
      .eq('id', id);

    if (error) {
      showError(`Erro ao deletar empresa: ${error.message}`);
      console.error('Delete error:', error);
    } else {
      showSuccess('Empresa deletada com sucesso!');
      fetchCompanies();
    }
  };

  if (checkingPermissions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isDev) {
    return null;
  }

  return (
    <main className="space-y-8 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>{editMode ? 'Editar Empresa' : 'Adicionar Nova Empresa'}</CardTitle>
          <CardDescription>Gerencie as empresas cadastradas na plataforma.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Empresa</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(XX) XXXXX-XXXX" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@empresa.com" required />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={ativo}
                  onCheckedChange={setAtivo}
                />
                <Label htmlFor="ativo">Ativo</Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editMode ? 'Salvar Alterações' : 'Adicionar Empresa'}
              </Button>
              {editMode && (
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                  Cancelar Edição
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Empresas Cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : companies.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead>Inscrição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.nome}</TableCell>
                    <TableCell>{company.cnpj}</TableCell>
                    <TableCell>{company.email}</TableCell>
                    <TableCell>{company.telefone || '-'}</TableCell>
                    <TableCell>{company.ativo ? 'Sim' : 'Não'}</TableCell>
                    <TableCell>{new Date(company.data_inscricao).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-right space-x-1 flex justify-end items-center">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(company)}>
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(company.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>

                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-gray-500 py-8">Nenhuma empresa encontrada.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default AdminCompanies;