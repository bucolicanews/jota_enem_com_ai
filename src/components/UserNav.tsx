import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { Shield, LogOut, User as UserIcon, Settings, MessageSquareText, BookCopy, FileText, Users } from 'lucide-react'; // Added icons
import type { User } from '@supabase/supabase-js';
import { getPermissionStyle } from '@/utils/permissionStyles';
import { getPermissaoUsuario } from '@/utils/permissions'; // Import getPermissaoUsuario

// Alinhando a interface Profile com UserProfileData do MainLayout para consistência
interface Profile {
  id: string;
  nome: string | null;
  apelido: string | null;
  avatar_url: string | null;
  permissao_id: string | null;
  plano_id: string | null;
  creditos_perguntas: number;
  creditos_redacoes: number;
  creditos_simulados: number;
  parent_id: string | null;
  permissao_nome?: string;
  limite_usuarios_adicionais?: number;
  connected_students_count?: number;
}

interface UserNavProps {
  userProfileData: Profile | null;
}

export function UserNav({ userProfileData }: UserNavProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();
      if (loggedInUser) {
        setUser(loggedInUser);
        
        if (userProfileData) { // Usar dados da prop se disponíveis
          setProfile(userProfileData);
        } else { // Fallback: buscar perfil se a prop não for fornecida (menos ideal, MainLayout deve fornecer)
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('cliente')
              .select(`
                id,
                nome,
                apelido,
                avatar_url,
                permissao_id,
                plano_id,
                creditos_perguntas,
                creditos_redacoes,
                creditos_simulados,
                parent_id,
                permissao:permissao_id(nome),
                plano:plano_id(limite_usuarios_adicionais)
              `)
              .eq('id', loggedInUser.id)
              .single();

            if (profileError) {
              console.error('Erro ao carregar perfil:', profileError);
              return;
            }

            const permissao = Array.isArray(profileData?.permissao) ? profileData?.permissao[0] : profileData?.permissao;
            const planoData = Array.isArray(profileData?.plano) ? profileData?.plano[0] : profileData?.plano;

            let permissaoNome = permissao?.nome || 'Usuário';
            
            let connectedStudentsCount = 0;
            if (permissaoNome === 'Prof' && !profileData?.parent_id) {
              const { count, error: countError } = await supabase
                .from('cliente')
                .select('id', { count: 'exact', head: true })
                .eq('parent_id', loggedInUser.id);
              if (countError) console.error('Error fetching connected students count:', countError);
              else connectedStudentsCount = count || 0;
            }

            setProfile({
              id: profileData?.id || '', // Adicionado id
              nome: profileData?.nome || null,
              apelido: profileData?.apelido || null,
              avatar_url: profileData?.avatar_url || null,
              permissao_id: profileData?.permissao_id || null, // Adicionado permissao_id
              plano_id: profileData?.plano_id || null, // Adicionado plano_id
              creditos_perguntas: profileData?.creditos_perguntas || 0,
              creditos_redacoes: profileData?.creditos_redacoes || 0,
              creditos_simulados: profileData?.creditos_simulados || 0,
              parent_id: profileData?.parent_id || null, // Adicionado parent_id
              permissao_nome: permissaoNome,
              limite_usuarios_adicionais: planoData?.limite_usuarios_adicionais || 0,
              connected_students_count: connectedStudentsCount,
            });

          } catch (error) {
            console.error('Erro ao carregar perfil:', error);
          }
        }
      }
      setLoading(false);
    };
    fetchUserAndProfile();
  }, [userProfileData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '..';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const renderCredit = (creditValue: number | undefined) => {
    if (creditValue === -1) {
      return '∞'; // Símbolo de infinito
    }
    return creditValue ?? 0;
  };

  const displayName = profile?.apelido || profile?.nome || user?.email;
  const permissionStyle = profile?.permissao_nome ? getPermissionStyle(profile.permissao_nome) : getPermissionStyle('Usuário');

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-gray-200 animate-pulse"></div>
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Badge de permissão */}
      <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 transition-all duration-200 hover:scale-105 ${permissionStyle.bgColor} ${permissionStyle.borderColor} ${permissionStyle.color} hover:shadow-md`}>
        <Shield className={`h-3 w-3 ${permissionStyle.iconColor}`} />
        <span className="capitalize font-semibold">
          {profile?.permissao_nome?.toLowerCase() || 'usuário'}
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full hover:scale-105 transition-transform">
            <Avatar className="h-9 w-9">
              <AvatarImage src={profile?.avatar_url || ''} alt={displayName || ''} />
              <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email}
              </p>
              {profile?.permissao_nome && (
                <div className="flex items-center gap-1 mt-1">
                  <Shield className={`h-3 w-3 ${permissionStyle.iconColor}`} />
                  <span className={`text-xs font-medium capitalize ${permissionStyle.color}`}>
                    {profile.permissao_nome.toLowerCase()}
                  </span>
                </div>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => navigate('/perfil')}>
              <UserIcon className="mr-2 h-4 w-4" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/dashboard')}>
              <Settings className="mr-2 h-4 w-4" />
              Dashboard
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {/* Display credit limits */}
          <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">Créditos:</DropdownMenuLabel>
          <DropdownMenuItem className="text-xs">
            <MessageSquareText className="mr-2 h-4 w-4" /> Perguntas: {renderCredit(profile?.creditos_perguntas)}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs">
            <BookCopy className="mr-2 h-4 w-4" /> Redações: {renderCredit(profile?.creditos_redacoes)}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs">
            <FileText className="mr-2 h-4 w-4" /> Simulados: {renderCredit(profile?.creditos_simulados)}
          </DropdownMenuItem>
          {/* Display professor-specific info */}
          {profile?.permissao_nome === 'Prof' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">Gerenciamento de Alunos:</DropdownMenuLabel>
              <DropdownMenuItem className="text-xs">
                <Users className="mr-2 h-4 w-4" /> Alunos Conectados: {profile?.connected_students_count ?? 0} / {profile?.limite_usuarios_adicionais ?? 0}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}