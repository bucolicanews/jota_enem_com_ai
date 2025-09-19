import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, ShieldAlert, PlusCircle, Pencil, Trash2, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { requireAdmin } from '@/utils/permissions';
import Form_create_user from './Form_create_user';

interface Permissao {
  id: string;
  nome: string;
}

interface Empresa {
  id: string;
  nome: string;
}

interface UserProfile {
  id: string;
  email: string;
  nome: string;
  apelido: string;
  nivel_dificuldade: string;
  permissao_id: string;
  nome_permissao?: string;
  cod_empresa: string | null;
  nome_empresa?: string;
  bloqueado: boolean;
  ativo: boolean;
  data_criacao: string;
  nota_avaliacao: number;
  avatar_url?: string;
}

const UserCreate = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [apelido, setApelido] = useState('');
  const [nivelDificuldade, setNivelDificuldade] = useState('iniciante');
  const [permissaoSelecionadaId, setPermissaoSelecionadaId] = useState('');
  const [empresaSelecionadaId, setEmpresaSelecionadaId] = useState('');
  const [bloqueado, setBloqueado] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPermissao, setFilterPermissao] = useState('all');
  const [filterEmpresa, setFilterEmpresa] = useState('all');
  const [filterBloqueado, setFilterBloqueado] = useState('all');

  const fetchPermissoes = useCallback(async () => {
    const { data, error } = await supabase.from('permissoes').select('id, nome');
    if (error) console.error('Erro ao buscar permissões:', error);
    else setPermissoes(data || []);
  }, []);

  const fetchEmpresas = useCallback(async () => {
    const { data, error } = await supabase.from('empresa').select('id, nome');
    if (error) console.error('Erro ao buscar empresas:', error);
    else setEmpresas(data || []);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cliente')
      .select('*, permissao:permissao_id(nome), empresa(nome)')
      .order('data_criacao', { ascending: false });

    if (error) {
      showError('Erro ao carregar usuários.');
      console.error('Erro ao buscar usuários:', error);
    } else {
      const usersWithNames = data.map((user: any) => ({
        ...user,
        nome_permissao: user.permissao?.nome || 'N/A',
        nome_empresa: user.empresa?.nome || 'N/A'
      }));
      setUsers(usersWithNames);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const checkPermissionsAndFetchData = async () => {
      setCheckingPermissions(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      const canAccess = await requireAdmin(user.id);
      setIsAdmin(canAccess);
      if (canAccess) {
        fetchPermissoes();
        fetchEmpresas();
        fetchUsers();
      }
      setCheckingPermissions(false);
    };
    checkPermissionsAndFetchData();
  }, [navigate, fetchPermissoes, fetchEmpresas, fetchUsers]);

  useEffect(() => {
    if (editMode && currentUserId) {
      const userToEdit = users.find(u => u.id === currentUserId);
      if (userToEdit) {
        setEmail(userToEdit.email);
        setNome(userToEdit.nome);
        setApelido(userToEdit.apelido);
        setNivelDificuldade(userToEdit.nivel_dificuldade);
        setPermissaoSelecionadaId(userToEdit.permissao_id);
        setEmpresaSelecionadaId(userToEdit.cod_empresa || '');
        setBloqueado(userToEdit.bloqueado);
        setAvatarUrl(userToEdit.avatar_url || '');
      }
    }
  }, [editMode, currentUserId, users]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setNome('');
    setApelido('');
    setNivelDificuldade('iniciante');
    setPermissaoSelecionadaId('');
    setEmpresaSelecionadaId('');
    setBloqueado(false);
    setEditMode(false);
    setCurrentUserId(null);
    setAvatarUrl('');
  };

  const handleEditClick = (user: UserProfile) => {
    resetForm();
    setEditMode(true);
    setCurrentUserId(user.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Tem certeza que deseja deletar este usuário? Esta ação não pode ser desfeita.')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('cliente')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      showSuccess('Usuário deletado com sucesso!');
      fetchUsers();
    } catch (error: any) {
      showError(error.message || 'Erro ao deletar usuário');
      console.error('Erro detalhado:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !currentUserId) {
      showError("Nenhum arquivo selecionado.");
      return;
    }
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showError("A imagem é muito grande (máx. 5MB).");
      return;
    }
    const fileExt = file.name.split('.').pop();
    const filePath = `${currentUserId}/${Date.now()}.${fileExt}`;

    setUploading(true);
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });

    if (uploadError) {
      showError('Erro no upload do avatar');
      setUploading(false);
      console.error('Erro de upload:', uploadError);
      return;
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const publicUrl = data.publicUrl;

    const { error: updateError } = await supabase
      .from('cliente')
      .update({ avatar_url: publicUrl })
      .eq('id', currentUserId);

    if (updateError) {
      showError('Erro ao salvar a foto.');
      console.error('Erro de atualização do cliente:', updateError);
    } else {
      setAvatarUrl(publicUrl);
      showSuccess('Foto atualizada com sucesso!');
    }
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editMode || !currentUserId) {
      showError('Erro: Não é possível editar. Dados de usuário não encontrados.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('cliente')
        .update({
          nome,
          apelido,
          nivel_dificuldade: nivelDificuldade,
          permissao_id: permissaoSelecionadaId,
          cod_empresa: empresaSelecionadaId || null,
          bloqueado,
          ativo: !bloqueado
        })
        .eq('id', currentUserId);

      if (updateError) throw updateError;

      showSuccess('Usuário atualizado com sucesso!');
      resetForm();
      setIsFormOpen(false);
      fetchUsers();
    } catch (error: any) {
      showError(error.message || 'Erro ao salvar usuário.');
      console.error('Erro detalhado:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const lowerCaseSearch = searchTerm.toLowerCase();
      const matchesSearch = searchTerm ? (
        user.nome.toLowerCase().includes(lowerCaseSearch) ||
        user.email.toLowerCase().includes(lowerCaseSearch) ||
        user.apelido.toLowerCase().includes(lowerCaseSearch)
      ) : true;

      const matchesPermissao = filterPermissao !== 'all' ? user.nome_permissao === filterPermissao : true;
      const matchesEmpresa = filterEmpresa !== 'all' ? user.cod_empresa === filterEmpresa : true;
      const matchesBloqueado = filterBloqueado !== 'all' ? user.bloqueado === (filterBloqueado === 'true') : true;

      return matchesSearch && matchesPermissao && matchesEmpresa && matchesBloqueado;
    });
  }, [users, searchTerm, filterPermissao, filterEmpresa, filterBloqueado]);

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
    <div className="container max-w-7xl py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Usuário</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-4">
            {editMode ? (
              <>
                <DialogHeader>
                  <DialogTitle>Editar Usuário</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                  <div className="flex flex-col items-center gap-4">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={avatarUrl} alt={nome} />
                      <AvatarFallback>{nome?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleAvatarUpload}
                    />
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? "Enviando..." : "Alterar Foto"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <Input id="password" type="password" placeholder="Deixe em branco para não alterar" disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome Completo</Label>
                      <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do usuário" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apelido">Apelido</Label>
                      <Input id="apelido" value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Apelido no chat" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="permissao_id">Permissão *</Label>
                      <Select value={permissaoSelecionadaId} onValueChange={setPermissaoSelecionadaId}>
                        <SelectTrigger><SelectValue placeholder="Selecione a permissão" /></SelectTrigger>
                        <SelectContent>
                          {permissoes.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cod_empresa">Empresa</Label>
                      <div className="flex items-center gap-2">
                        <Select value={empresaSelecionadaId} onValueChange={setEmpresaSelecionadaId}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Selecione a empresa" />
                          </SelectTrigger>
                          <SelectContent>
                            {empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                          </SelectContent>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setEmpresaSelecionadaId('')}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </Select>



                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nivel_dificuldade">Nível de Dificuldade</Label>
                      <Select value={nivelDificuldade} onValueChange={setNivelDificuldade}>
                        <SelectTrigger><SelectValue placeholder="Nível de Dificuldade" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iniciante">Iniciante</SelectItem>
                          <SelectItem value="intermediario">Intermediário</SelectItem>
                          <SelectItem value="avancado">Avançado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="bloqueado" checked={bloqueado} onCheckedChange={setBloqueado} />
                      <Label htmlFor="bloqueado">Usuário Bloqueado</Label>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Alterações
                  </Button>
                </form>
              </>
            ) : (
                <Form_create_user onSuccess={fetchUsers} />
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <Input
            placeholder="Buscar por nome, email ou apelido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-auto flex-grow"
          />
          <Select value={filterPermissao} onValueChange={setFilterPermissao}>
            <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filtrar por permissão" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Permissões</SelectItem>
              {permissoes.map(p => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
            <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filtrar por empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Empresas</SelectItem>
              {empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterBloqueado} onValueChange={setFilterBloqueado}>
            <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="false">Ativos</SelectItem>
              <SelectItem value="true">Bloqueados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usuários</CardTitle>
            <CardDescription>Lista de usuários cadastrados</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                      <TableHead>Apelido</TableHead>
                    <TableHead>Permissão</TableHead>
                    <TableHead>Empresa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map(user => (
                        <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar_url} alt={user.nome} />
                              <AvatarFallback>{user.nome?.[0] || "?"}</AvatarFallback>
                            </Avatar>
                            {user.nome}
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.apelido}</TableCell>
                        <TableCell>{user.nome_permissao}</TableCell>
                        <TableCell>{user.nome_empresa}</TableCell>
                        <TableCell>
                          {user.bloqueado ? (
                            <span className="text-red-600 font-medium">Bloqueado</span>
                          ) : (
                            <span className="text-green-600 font-medium">Ativo</span>
                          )}
                        </TableCell>
                        <TableCell className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(user)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                    ) : (
                    <TableRow>
                          <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                            Nenhum usuário encontrado
                          </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserCreate;
