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
import { Shield, LogOut, User as UserIcon, Settings } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { getPermissionStyle } from '@/utils/permissionStyles';

interface Profile {
  nome: string | null;
  apelido: string | null;
  avatar_url: string | null;
  permissao_nome?: string;
}

export function UserNav() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        
        try {
          // Buscar perfil do usuário
          const { data: profileData, error: profileError } = await supabase
            .from('cliente')
            .select('nome, apelido, avatar_url, permissao_id')
            .eq('id', user.id)
            .single();

          if (profileError) {
            console.error('Erro ao carregar perfil:', profileError);
            return;
          }

          let permissaoNome = 'Usuário';

          // Buscar nome da permissão separadamente
          if (profileData?.permissao_id) {
            const { data: permissaoData, error: permissaoError } = await supabase
              .from('permissoes')
              .select('nome')
              .eq('id', profileData.permissao_id)
              .single();

            if (!permissaoError && permissaoData) {
              permissaoNome = permissaoData.nome;
            }
          }

          setProfile({
            nome: profileData?.nome || null,
            apelido: profileData?.apelido || null,
            avatar_url: profileData?.avatar_url || null,
            permissao_nome: permissaoNome
          });

        } catch (error) {
          console.error('Erro ao carregar perfil:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchUserAndProfile();
  }, []);

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
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}