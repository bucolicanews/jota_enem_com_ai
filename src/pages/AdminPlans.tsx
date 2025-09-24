import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, PlusCircle, Pencil, Trash2, ShieldAlert, RefreshCw } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { requireAdmin } from '@/utils/permissions';

interface Plano {
  id: string;
  nome: string;
  id_stripe_product: string | null;
  id_stripe_price_monthly: string | null;
  id_stripe_price_one_time: string | null;
  tipo: 'recorrente' | 'pre_pago';
  preco: number;
  limite_perguntas: number;
  limite_redacoes: number;
  limite_simulados: number;
  limite_usuarios_adicionais: number;
  created_at: string;
  updated_at: string;
}

const AdminPlans = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [plans, setPlans] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [editMode, setEditMode] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<Plano | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'recorrente' | 'pre_pago'>('recorrente');
  const [preco, setPreco] = useState('');
  const [limitePerguntas, setLimitePerguntas] = useState('0');
  const [limiteRedacoes, setLimiteRedacoes] = useState('0');
  const [limiteSimulados, setLimiteSimulados] = useState('0');
  const [limiteUsuariosAdicionais, setLimiteUsuariosAdicionais] = useState('0');

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('planos')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      showError('Erro ao carregar planos.');
      console.error('Error fetching plans:', error);
    } else {
      setPlans(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const checkPermissionsAndFetchData = async () => {
      setCheckingPermissions(true);
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();
      if (!loggedInUser) {
        navigate('/login');
        return;
      }
      setUser(loggedInUser);
      const canAccess = await requireAdmin(loggedInUser.id);
      setIsAdmin(canAccess);
      if (canAccess) {
        fetchPlans();
      }
      setCheckingPermissions(false);
    };
    checkPermissionsAndFetchData();
  }, [navigate, fetchPlans]);

  const resetForm = () => {
    setEditMode(false);
    setCurrentPlan(null);
    setNome('');
    setTipo('recorrente');
    setPreco('');
    setLimitePerguntas('0');
    setLimiteRedacoes('0');
    setLimiteSimulados('0');
    setLimiteUsuariosAdicionais('0');
  };

  const handleEditClick = (plan: Plano) => {
    setEditMode(true);
    setCurrentPlan(plan);
    setNome(plan.nome);
    setTipo(plan.tipo);
    setPreco(plan.preco.toString());
    setLimitePerguntas(plan.limite_perguntas.toString());
    setLimiteRedacoes(plan.limite_redacoes.toString());
    setLimiteSimulados(plan.limite_simulados.toString());
    setLimiteUsuariosAdicionais(plan.limite_usuarios_adicionais.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showError('Acesso negado.');
      return;
    }
    if (!nome.trim() || !preco.trim() || parseFloat(preco) <= 0) {
      showError('Nome e preço válidos são obrigatórios.');
      return;
    }

    setIsSubmitting(true);

    const planData = {
      nome: nome.trim(),
      tipo,
      preco: parseFloat(preco),
      limite_perguntas: parseInt(limitePerguntas),
      limite_redacoes: parseInt(limiteRedacoes),
      limite_simulados: parseInt(limiteSimulados),
      limite_usuarios_adicionais: parseInt(limiteUsuariosAdicionais),
    };

    let error = null;
    if (editMode && currentPlan) {
      // Update existing plan
      const { error: updateError } = await supabase
        .from('planos')
        .update(planData)
        .eq('id', currentPlan.id);
      error = updateError;
    } else {
      // Insert new plan
      const { error: insertError } = await supabase
        .from('planos')
        .insert(planData);
      error = insertError;
    }

    if (error) {
      showError(`Erro ao ${editMode ? 'atualizar' : 'adicionar'} plano: ${error.message}`);
      console.error('Submit plan error:', error);
    } else {
      showSuccess(`Plano ${editMode ? 'atualizado' : 'adicionado'} com sucesso!`);
      resetForm();
      fetchPlans();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (planId: string) => {
    if (!isAdmin) {
      showError('Acesso negado.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja deletar este plano? Esta ação é irreversível e pode afetar usuários com este plano.')) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('planos')
        .delete()
        .eq('id', planId);

      if (error) throw error;

      showSuccess('Plano deletado com sucesso!');
      fetchPlans();
    } catch (error: any) {
      showError(`Erro ao deletar plano: ${error.message}`);
      console.error('Delete plan error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkingPermissions) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive"><ShieldAlert className="h-12 w-12 mx-auto mb-4" />Acesso Negado</CardTitle>
            <CardDescription className="text-center">Apenas administradores podem acessar esta página.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/dashboard')}>Voltar para o Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
      <h1 className="text-3xl font-bold">Gerenciar Planos</h1>

      {/* Card para Adicionar/Editar Plano */}
      <Card>
        <CardHeader>
          <CardTitle>{editMode ? 'Editar Plano' : 'Adicionar Novo Plano'}</CardTitle>
          <CardDescription>
            {editMode ? 'Atualize os detalhes do plano existente.' : 'Crie um novo plano de assinatura ou pré-pago.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Plano</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de Plano</Label>
                <Select value={tipo} onValueChange={(value: 'recorrente' | 'pre_pago') => setTipo(value)} required>
                  <SelectTrigger id="tipo"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recorrente">Recorrente (Assinatura)</SelectItem>
                    <SelectItem value="pre_pago">Pré-pago (Créditos Únicos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preco">Preço (R$)</Label>
                <Input id="preco" type="number" value={preco} onChange={(e) => setPreco(e.target.value)} min="0.01" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limite-perguntas">Limite de Perguntas</Label>
                <Input id="limite-perguntas" type="number" value={limitePerguntas} onChange={(e) => setLimitePerguntas(e.target.value)} min="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limite-redacoes">Limite de Redações</Label>
                <Input id="limite-redacoes" type="number" value={limiteRedacoes} onChange={(e) => setLimiteRedacoes(e.target.value)} min="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limite-simulados">Limite de Simulados</Label>
                <Input id="limite-simulados" type="number" value={limiteSimulados} onChange={(e) => setLimiteSimulados(e.target.value)} min="0" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="limite-usuarios-adicionais">Limite de Usuários Adicionais (Plano Professor)</Label>
                <Input id="limite-usuarios-adicionais" type="number" value={limiteUsuariosAdicionais} onChange={(e) => setLimiteUsuariosAdicionais(e.target.value)} min="0" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editMode ? 'Salvar Alterações' : 'Adicionar Plano'}
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

      {/* Card para Listar Planos */}
      <Card>
        <CardHeader>
          <CardTitle>Planos Cadastrados</CardTitle>
          <CardDescription>Visualize e gerencie todos os planos disponíveis.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8">
              <XCircle className="h-12 w-12 mb-4 text-gray-400" />
              <p>Nenhum plano cadastrado ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Perguntas</TableHead>
                  <TableHead>Redações</TableHead>
                  <TableHead>Simulados</TableHead>
                  <TableHead>Usuários Add.</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map(plan => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.nome}</TableCell>
                    <TableCell>{plan.tipo === 'recorrente' ? 'Recorrente' : 'Pré-pago'}</TableCell>
                    <TableCell>R$ {plan.preco.toFixed(2)}</TableCell>
                    <TableCell>{plan.limite_perguntas}</TableCell>
                    <TableCell>{plan.limite_redacoes}</TableCell>
                    <TableCell>{plan.limite_simulados}</TableCell>
                    <TableCell>{plan.limite_usuarios_adicionais}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(plan)}>
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(plan.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPlans;