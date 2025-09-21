import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate, useParams } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';
import { Pencil, Trash2, Loader2, Shield } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { getPermissionStyle } from '@/utils/permissionStyles';
import { getPermissaoUsuario, requireAdmin } from '@/utils/permissions'; // Importar requireAdmin

interface Permissao {
  id: string;
  nome: string;
}

interface Empresa {
  id: string;
  nome: string;
}

// Definindo a interface para o perfil do cliente com a estrutura correta
interface ClienteProfile { // Renomeado para ClienteProfile para evitar confusão
  id: string; // Adicionado ID para o perfil que está sendo editado
  nome: string | null;
  apelido: string | null;
  avatar_url: string | null;
  permissao_id: string | null;
  nivel_dificuldade: string | null;
  cod_empresa: string | null;
  bloqueado: boolean;
  email: string; // Adicionado email para exibição
}

const ProfileFormAdmin = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>(); // O ID do usuário a ser editado
  const [adminUser, setAdminUser] = useState<User | null>(null); // O usuário logado (admin)
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [nome, setNome] = useState('');
  const [apelido, setApelido] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [permissaoNome, setPermissaoNome] = useState<string>('Carregando...');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para os campos editáveis pelo admin
  const [emailDisplay, setEmailDisplay] = useState('');
  const [nivelDificuldade, setNivelDificuldade] = useState('iniciante');
  const [permissaoSelecionadaId, setPermissaoSelecionadaId] = useState('');
  const [empresaSelecionadaId, setEmpresaSelecionadaId] = useState('');
  const [bloqueado, setBloqueado] = useState(false);
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [hasAdminAccess, setHasAdminAccess] = useState(false); // Para verificar se o usuário logado é admin

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '..';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    const checkAdminAndFetchProfile = async () => {
      setLoading(true);
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();

      if (!loggedInUser) {
        navigate('/login');
        return;
      }
      setAdminUser(loggedInUser);

      const isAdmin = await requireAdmin(loggedInUser.id);
      setHasAdminAccess(isAdmin);

      if (!isAdmin) {
        showError('Acesso negado. Apenas administradores podem gerenciar perfis.');
        navigate('/dashboard');
        return;
      }

      if (!id) {
        showError('ID do perfil não fornecido para edição.');
        navigate('/admin/profiles'); // Redireciona para a lista de perfis se não houver ID
        return;
      }

      try {
        // Fetch do perfil do usuário a ser editado
        const { data: profile, error: profileError } = await supabase
          .from('cliente')
          .select('id, nome, apelido, avatar_url, permissao_id, nivel_dificuldade, cod_empresa, bloqueado, email')
          .eq('id', id)
          .single<ClienteProfile>();

        if (profileError) {
          console.error('Erro ao carregar perfil:', profileError);
          showError('Não foi possível carregar o perfil.');
          setLoading(false);
          return;
        }

        if (profile) {
          setNome(profile.nome || '');
          setApelido(profile.apelido || '');
          setAvatarUrl(profile.avatar_url || '');
          setEmailDisplay(profile.email || '');
          setNivelDificuldade(profile.nivel_dificuldade || 'iniciante');
          setPermissaoSelecionadaId(profile.permissao_id || '');
          setEmpresaSelecionadaId(profile.cod_empresa || '');
          setBloqueado(profile.bloqueado || false);

          // Buscar nome da permissão para exibição
          if (profile.permissao_id) {
            const { data: permissaoData, error: permissaoError } = await supabase
              .from('permissoes')
              .select('nome')
              .eq('id', profile.permissao_id)
              .single();
            if (!permissaoError && permissaoData) {
              setPermissaoNome(permissaoData.nome);
            } else {
              console.error('Erro ao buscar nome da permissão:', permissaoError);
              setPermissaoNome('N/A');
            }
          } else {
            setPermissaoNome('N/A');
          }
        }

        // Fetch de opções de seleção (permissões e empresas)
        const { data: permissoesData, error: permissoesError } = await supabase.from('permissoes').select('id, nome');
        const { data: empresasData, error: empresasError } = await supabase.from('empresa').select('id, nome');

        if (permissoesError) console.error('Erro ao buscar permissões:', permissoesError);
        else setPermissoes(permissoesData || []);

        if (empresasError) console.error('Erro ao buscar empresas:', empresasError);
        else setEmpresas(empresasData || []);

      } catch (error) {
        console.error('Erro no fetch do perfil:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAdminAndFetchProfile();
  }, [navigate, id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser || !id) return;
    setLoading(true);

    // Atualiza o perfil na tabela 'cliente'
    const { error } = await supabase
      .from('cliente')
      .update({
        nome,
        apelido,
        nivel_dificuldade: nivelDificuldade,
        permissao_id: permissaoSelecionadaId,
        cod_empresa: empresaSelecionadaId || null, // Garante que seja null se vazio
        bloqueado: bloqueado,
        ativo: !bloqueado, // Ativo é o inverso de bloqueado
      })
      .eq('id', id);

    if (error) {
      showError('Erro ao atualizar o perfil.');
      console.error('Error updating profile:', error);
    } else {
      showSuccess('Perfil atualizado com sucesso!');
      // Opcional: redirecionar de volta para a lista de perfis ou recarregar
      // navigate('/admin/profiles');
    }
    setLoading(false);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !id) {
      return;
    }

    const file = event.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showError("A imagem é muito grande. O limite é 5MB.");
      return;
    }
    const fileExt = file.name.split('.').pop();
    const filePath = `${id}/${Date.now()}.${fileExt}`;

    setUploading(true);

    if (avatarUrl) {
      const oldFilePath = avatarUrl.split('/avatars/')[1];
      if (oldFilePath) await supabase.storage.from('avatars').remove([oldFilePath]);
    }

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) {
      showError('Falha no upload da imagem.');
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

    const { error: updateError } = await supabase
      .from('cliente')
      .update({ avatar_url: publicUrl })
      .eq('id', id);

    if (updateError) {
      showError('Erro ao salvar a nova foto.');
      await supabase.storage.from('avatars').remove([filePath]);
    } else {
      setAvatarUrl(publicUrl);
      showSuccess('Foto de perfil atualizada!');
    }
    setUploading(false);
  };

  const handleDeleteAvatar = async () => {
    if (!id || !avatarUrl) return;

    const filePath = avatarUrl.split('/avatars/')[1];
    if (!filePath) {
      showError('Não foi possível identificar o arquivo a ser deletado.');
      return;
    }

    const { error: removeError } = await supabase.storage.from('avatars').remove([filePath]);
    if (removeError) {
      showError('Erro ao deletar a foto.');
      return;
    }

    const { error: updateError } = await supabase.from('cliente').update({ avatar_url: null }).eq('id', id);
    if (updateError) {
      showError('Erro ao remover a foto do perfil.');
    } else {
      setAvatarUrl('');
      showSuccess('Foto de perfil removida.');
    }
  };

  const permissionStyle = getPermissionStyle(permissaoNome);
  const canEdit = hasAdminAccess; // Apenas admins podem editar nesta página

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div className="flex justify-center items-center min-h-screen text-center">
        <p>Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Editar Perfil do Usuário</CardTitle>
          <CardDescription>Gerencie as informações completas do usuário.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 flex flex-col items-center mb-6">
            <Label>Foto de Perfil</Label>
            <div className="relative group">
              <Avatar className="h-24 w-24 border-2 border-gray-200">
                <AvatarImage src={avatarUrl} alt="Foto de perfil" />
                <AvatarFallback>{getInitials(apelido || nome)}</AvatarFallback>
              </Avatar>
              {!uploading && canEdit && (
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center gap-2 rounded-full transition-opacity duration-300">
                  <Button type="button" variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 rounded-full" onClick={() => fileInputRef.current?.click()}>
                    <Pencil className="h-5 w-5 text-white" />
                  </Button>
                  {avatarUrl && (
                    <Button type="button" variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 rounded-full" onClick={handleDeleteAvatar}>
                      <Trash2 className="h-5 w-5 text-red-500" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg" onChange={handleAvatarUpload} disabled={uploading || !canEdit} />
          </div>
          <div className={`mb-6 p-3 rounded-lg flex items-center gap-2 border ${permissionStyle.bgColor} ${permissionStyle.borderColor}`}>
            <Shield className={`h-5 w-5 ${permissionStyle.iconColor}`} />
            <div>
              <p className={`text-sm font-medium ${permissionStyle.color}`}>Nível de Permissão</p>
              <p className={`text-sm font-semibold ${permissionStyle.color}`}>
                {permissaoNome.toLowerCase()}
              </p>
            </div>
          </div>
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={emailDisplay} disabled /> {/* Email é apenas para exibição */}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input id="nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo do usuário" disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apelido">Apelido (para o chat)</Label>
              <Input id="apelido" type="text" value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Apelido no chat" disabled={!canEdit} />
            </div>

            {/* Campos adicionais - Editáveis apenas por Admin */}
            <div className="space-y-2">
              <Label htmlFor="permissao_id">Permissão</Label>
              <Select value={permissaoSelecionadaId} onValueChange={setPermissaoSelecionadaId} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="Selecione a permissão" /></SelectTrigger>
                <SelectContent>
                  {permissoes.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cod_empresa">Empresa</Label>
              <Select value={empresaSelecionadaId || ''} onValueChange={setEmpresaSelecionadaId} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nivel_dificuldade">Nível de Dificuldade</Label>
              <Select value={nivelDificuldade} onValueChange={setNivelDificuldade} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="Nível de Dificuldade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="iniciante">Iniciante</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="bloqueado" checked={bloqueado} onCheckedChange={setBloqueado} disabled={!canEdit} />
              <Label htmlFor="bloqueado">Usuário Bloqueado</Label>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !canEdit}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileFormAdmin;