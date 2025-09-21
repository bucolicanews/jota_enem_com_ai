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
import { getPermissaoUsuario } from '@/utils/permissions';

interface Permissao {
  id: string;
  nome: string;
}

interface Empresa {
  id: string;
  nome: string;
}

// Definindo a interface para o perfil do cliente com a estrutura correta
interface ClienteProfile {
  nome: string | null;
  apelido: string | null;
  avatar_url: string | null;
  permissao: Permissao | null; // Corrigido para ser um objeto ou null
  nivel_dificuldade: string | null;
  cod_empresa: string | null;
  bloqueado: boolean; // Adicionado
}

const Profile = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [nome, setNome] = useState('');
  const [apelido, setApelido] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [permissaoNome, setPermissaoNome] = useState<string>('Carregando...');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Novos estados para os campos adicionais
  const [nivelDificuldade, setNivelDificuldade] = useState('iniciante');
  const [permissaoSelecionadaId, setPermissaoSelecionadaId] = useState('');
  const [empresaSelecionadaId, setEmpresaSelecionadaId] = useState('');
  const [bloqueado, setBloqueado] = useState(false);
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '..';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();

      if (!loggedInUser) {
        navigate('/login');
        return;
      }
      setUser(loggedInUser);

      const loggedInUserPermission = await getPermissaoUsuario(loggedInUser.id);
      const profileIdToFetch = id || loggedInUser.id;

      try {
        // Fetch do perfil com todos os campos necessários
        const { data: profile, error: profileError } = await supabase
          .from('cliente')
          .select('nome, apelido, avatar_url, permissao:permissao_id(id, nome), nivel_dificuldade, cod_empresa, bloqueado') // Adicionado 'bloqueado'
          .eq('id', profileIdToFetch)
          .single<ClienteProfile>(); // <--- Explicitamente tipando o retorno

        if (profileError) {
          console.error('Erro ao carregar perfil:', profileError);
          showError('Não foi possível carregar o perfil.');
          setPermissaoNome(loggedInUserPermission);
          setLoading(false);
          return;
        }

        if (profile) {
          setNome(profile.nome || '');
          setApelido(profile.apelido || '');
          setAvatarUrl(profile.avatar_url || '');
          setNivelDificuldade(profile.nivel_dificuldade || 'iniciante');
          setPermissaoSelecionadaId(profile.permissao?.id || '');
          setEmpresaSelecionadaId(profile.cod_empresa || '');
          setBloqueado(profile.bloqueado || false); // Usando a propriedade 'bloqueado'

          if (id && profile.permissao && profile.permissao.nome) {
            setPermissaoNome(profile.permissao.nome);
          } else {
            setPermissaoNome(loggedInUserPermission);
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

    fetchProfile();
  }, [navigate, id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const profileIdToUpdate = id || user.id;

    // Atualiza o perfil na tabela 'cliente'
    const { error } = await supabase
      .from('cliente')
      .update({
        nome,
        apelido,
        nivel_dificuldade: nivelDificuldade,
        permissao_id: permissaoSelecionadaId,
        cod_empresa: empresaSelecionadaId,
        bloqueado: bloqueado,
        ativo: !bloqueado,
      })
      .eq('id', profileIdToUpdate);

    if (error) {
      showError('Erro ao atualizar o perfil.');
      console.error('Error updating profile:', error);
    } else {
      showSuccess('Perfil atualizado com sucesso!');
    }
    setLoading(false);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user) {
      return;
    }

    const file = event.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showError("A imagem é muito grande. O limite é 5MB.");
      return;
    }
    const fileExt = file.name.split('.').pop();
    const filePath = `${id || user.id}/${Date.now()}.${fileExt}`;

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
    const profileIdToUpdate = id || user.id;

    const { error: updateError } = await supabase
      .from('cliente')
      .update({ avatar_url: publicUrl })
      .eq('id', profileIdToUpdate);

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
    if (!user || !avatarUrl) return;

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
    const profileIdToUpdate = id || user.id;

    const { error: updateError } = await supabase.from('cliente').update({ avatar_url: null }).eq('id', profileIdToUpdate);
    if (updateError) {
      showError('Erro ao remover a foto do perfil.');
    } else {
      setAvatarUrl('');
      showSuccess('Foto de perfil removida.');
    }
  };

  const permissionStyle = getPermissionStyle(permissaoNome);
  const isMyProfile = !id || id === user?.id;
  const canEdit = isMyProfile || permissaoNome === 'Admin';

  if (loading && !nome && !apelido) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{isMyProfile ? 'Meu Perfil' : 'Editar Perfil'}</CardTitle>
          <CardDescription>Atualize as informações pessoais e de chat.</CardDescription>
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
            <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg" onChange={handleAvatarUpload} disabled={uploading} />
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
              <Input id="email" type="email" value={user?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input id="nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apelido">Apelido (para o chat)</Label>
              <Input id="apelido" type="text" value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Como você quer ser chamado no chat" disabled={!canEdit} />
            </div>

            {/* Campos adicionais */}
            {/* Estes campos são apenas para visualização no perfil do usuário comum, não para edição */}
            {canEdit && (
              <>
                <div>
                  <h1>Informações Adicionais</h1>
                </div>
              </>
            )}

            {canEdit && (
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;