import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Pencil, Trash2, PlusCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import From_create_user from './Form_create_user';

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
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // campos do formulário
  const [nome, setNome] = useState('');
  const [apelido, setApelido] = useState('');
  const [permissao, setPermissao] = useState('free'); // padrão
  const [empresa, setEmpresa] = useState<string | null>(null); // null permitido
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cliente')
      .select('*, permissao:permissao_id(nome), empresa(nome)')
      .order('data_criacao', { ascending: false });

    if (error) {
      showError('Erro ao carregar usuários.');
    } else {
      const usersWithNames = data.map((user: any) => ({
        ...user,
        nome_permissao: user.permissao?.nome || 'N/A',
        nome_empresa: user.empresa?.nome || 'Sem empresa'
      }));
      setUsers(usersWithNames);
    }
    setLoading(false);
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !currentUserId) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showError("A imagem é muito grande (máx. 5MB).");
      return;
    }

    const fileExt = file.name.split('.').pop();
    const filePath = `${currentUserId}/${Date.now()}.${fileExt}`;

    setUploading(true);

    // Upload
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
    if (uploadError) {
      showError('Erro no upload do avatar');
      setUploading(false);
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
    } else {
      setAvatarUrl(publicUrl);
      showSuccess('Foto atualizada!');
      fetchUsers();
    }
    setUploading(false);
  };

  const handleEditClick = (user: UserProfile) => {
    setEditMode(true);
    setCurrentUserId(user.id);
    setNome(user.nome);
    setApelido(user.apelido);
    setPermissao(user.permissao_id || 'free');
    setEmpresa(user.cod_empresa || null);
    setAvatarUrl(user.avatar_url || '');
    setIsFormOpen(true);
  };

  return (
    <div className="container max-w-7xl py-8">
      <h1 className="text-3xl font-bold mb-6">Gerenciar Usuários</h1>

      {/* Formulário de edição */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogTrigger asChild>
          <Button onClick={() => { setEditMode(false); setIsFormOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Usuário
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          {editMode ? (
            <form className="space-y-6">
              <DialogHeader>
                <DialogTitle>Editar Usuário</DialogTitle>
                <DialogDescription>Altere os dados do usuário.</DialogDescription>
              </DialogHeader>

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
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  {uploading ? "Enviando..." : "Alterar Foto"}
                </Button>
              </div>

              <div>
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <Label>Apelido</Label>
                <Input value={apelido} onChange={(e) => setApelido(e.target.value)} />
              </div>

              {/* Select de Permissão */}
              <div>
                <Label>Permissão</Label>
                <Select value={permissao} onValueChange={setPermissao}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Select de Empresa */}
              <div>
                <Label>Empresa</Label>
                <Select value={empresa || 'null'} onValueChange={(v) => setEmpresa(v === 'null' ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Sem empresa</SelectItem>
                    {/* Aqui você pode mapear empresas reais */}
                    <SelectItem value="1">Empresa 1</SelectItem>
                    <SelectItem value="2">Empresa 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit">Salvar</Button>
            </form>
          ) : (
            <From_create_user onSuccess={fetchUsers} />
          )}
        </DialogContent>
      </Dialog>

      {/* Lista de usuários com coluna Foto */}
      <Card className="mt-6">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Foto</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Permissão</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || ''} alt={user.nome} />
                        <AvatarFallback>{user.nome?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>{user.nome}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.nome_permissao}</TableCell>
                    <TableCell>{user.nome_empresa || 'Sem empresa'}</TableCell>
                    <TableCell>{user.bloqueado ? 'Bloqueado' : 'Ativo'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4" />
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

export default UserCreate;
