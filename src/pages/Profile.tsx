import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom'; // Removido useParams
import { showSuccess, showError } from '@/utils/toast';
import { Pencil, Trash2, Loader2, Shield } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { getPermissionStyle } from '@/utils/permissionStyles';
import { getPermissaoUsuario } from '@/utils/permissions';

// Definindo a interface para o perfil do cliente com a estrutura correta
interface ClienteProfile {
  nome: string | null;
  apelido: string | null;
  avatar_url: string | null;
  permissao_id: string | null; // Agora apenas o ID da permissão
  nivel_dificuldade: string | null;
  cod_empresa: string | null;
  bloqueado: boolean;
}

const Profile = () => {
  const navigate = useNavigate();
  // Removido { id } = useParams(); - este componente é sempre para o próprio usuário
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [nome, setNome] = useState('');
  const [apelido, setApelido] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [permissaoNome, setPermissaoNome] = useState<string>('Carregando...');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para exibir (somente leitura) os campos restritos
  const [nivelDificuldadeDisplay, setNivelDificuldadeDisplay] = useState('iniciante');
  const [empresaNomeDisplay, setEmpresaNomeDisplay] = useState('N/A');
  const [bloqueadoDisplay, setBloqueadoDisplay] = useState(false);

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

      try {
        // Fetch do perfil do próprio usuário
        const { data: profile, error: profileError } = await supabase
          .from('cliente')
          .select('nome, apelido, avatar_url, permissao_id, nivel_dificuldade, cod_empresa, bloqueado')
          .eq('id', loggedInUser.id)
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
          setNivelDificuldadeDisplay(profile.nivel_dificuldade || 'iniciante');
          setBloqueadoDisplay(profile.bloqueado || false);

          // Buscar nome da permissão
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
              setPermissaoNome('Usuário');
            }
          } else {
            setPermissaoNome('Usuário');
          }

          // Buscar nome da empresa
          if (profile.cod_empresa) {
            const { data: empresaData, error: empresaError } = await supabase
              .from('empresa')
              .select('nome')
              .eq('id', profile.cod_empresa)
              .single();
            if (!empresaError && empresaData) {
              setEmpresaNomeDisplay(empresaData.nome);
            } else {
              console.error('Erro ao buscar nome da empresa:', empresaError);
              setEmpresaNomeDisplay('N/A');
            }
          } else {
            setEmpresaNomeDisplay('N/A');
          }
        }

      } catch (error) {
        console.error('Erro no fetch do perfil:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    // Atualiza apenas nome, apelido e avatar_url na tabela 'cliente'
    const { error } = await supabase
      .from('cliente')
      .update({
        nome,
        apelido,
      })
      .eq('id', user.id);

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
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

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
      .eq('id', user.id);

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

    const { error: updateError } = await supabase.from('cliente').update({ avatar_url: null }).eq('id', user.id);
    if (updateError) {
      showError('Erro ao remover a foto do perfil.');
    } else {
      setAvatarUrl('');
      showSuccess('Foto de perfil removida.');
    }
  };

  const permissionStyle = getPermissionStyle(permissaoNome);
  // canEdit é sempre true para o próprio usuário
  const canEdit = true; 

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
          <CardTitle className="text-2xl">Meu Perfil</CardTitle>
          <CardDescription>Atualize suas informações pessoais e de chat.</CardDescription>
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

            {/* Campos adicionais (somente leitura para usuários comuns) */}
            <div className="space-y-2">
              <Label htmlFor="nivel_dificuldade_display">Nível de Dificuldade</Label>
              <Input id="nivel_dificuldade_display" value={nivelDificuldadeDisplay} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresa_display">Empresa</Label>
              <Input id="empresa_display" value={empresaNomeDisplay} disabled />
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="bloqueado_display" checked={bloqueadoDisplay} disabled />
              <Label htmlFor="bloqueado_display">Usuário Bloqueado</Label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
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

export default Profile;