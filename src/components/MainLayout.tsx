import { Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { UserNav } from './UserNav';
import { ArrowLeft, Home, User, MessageSquare, BookOpen, Newspaper, Settings, KeyRound, DollarSign, Shield, Crown } from 'lucide-react'; // Added Crown icon
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client'; // Import supabase
import { checkUserPermissions, UserPermissions } from '@/utils/permissions'; // Import checkUserPermissions

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  showBackButton?: boolean;
  actions?: React.ReactNode;
  useContainer?: boolean;
}

// Add new interface for profile data to pass
interface UserProfileData {
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
  permissao_nome?: string; // Added for convenience
  limite_usuarios_adicionais?: number; // From plan
  connected_students_count?: number; // For professors
}

export const MainLayout = ({ children, title, showBackButton = true, actions, useContainer = true }: MainLayoutProps) => {
  const navigate = useNavigate();
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [userProfileData, setUserProfileData] = useState<UserProfileData | null>(null); // New state for profile data

  useEffect(() => {
    const getUserAndPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const permissions = await checkUserPermissions(user.id);
        setUserPermissions(permissions);

        // Fetch detailed profile data
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
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Error fetching detailed user profile:', profileError);
        } else if (profileData) {
          // Ajuste aqui: Acessar o primeiro elemento do array 'permissao' e 'plano'
          const permissao = Array.isArray(profileData.permissao) ? profileData.permissao[0] : profileData.permissao;
          const plano = Array.isArray(profileData.plano) ? profileData.plano[0] : profileData.plano;

          const profile: UserProfileData = {
            id: profileData.id,
            nome: profileData.nome,
            apelido: profileData.apelido,
            avatar_url: profileData.avatar_url,
            permissao_id: profileData.permissao_id,
            plano_id: profileData.plano_id,
            creditos_perguntas: profileData.creditos_perguntas,
            creditos_redacoes: profileData.creditos_redacoes,
            creditos_simulados: profileData.creditos_simulados,
            parent_id: profileData.parent_id,
            permissao_nome: permissao?.nome, // Acessar de permissao
            limite_usuarios_adicionais: plano?.limite_usuarios_adicionais, // Acessar de plano
          };

          // If user is a professor, fetch connected students count
          if (permissions.isProf && !profile.parent_id) { // Only if they are a professor and not a student themselves
            const { count, error: countError } = await supabase
              .from('cliente')
              .select('id', { count: 'exact', head: true })
              .eq('parent_id', user.id);

            if (countError) {
              console.error('Error fetching connected students count:', countError);
            } else {
              profile.connected_students_count = count || 0;
            }
          }
          setUserProfileData(profile);
        }
      } else {
        setUserPermissions(null);
        setUserProfileData(null);
      }
      setLoadingPermissions(false);
    };
    getUserAndPermissions();
  }, []);

  const showUpgradeButton = !loadingPermissions && userPermissions && (userPermissions.isFree || userPermissions.isPro);

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-x-hidden">
      {/* Header com logo e navegação */}
      <header className="flex-shrink-0 sticky top-0 z-50 w-full border-b bg-white backdrop-blur supports-[backdrop-filter]:bg-white/95">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Logo JOTA ENEM */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">J</span>
              </div>
              <span className="font-bold text-xl text-gray-800 hidden sm:block">JOTA ENEM</span>
            </div>

            {/* Navegação principal */}
            <nav className="hidden md:flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-2">
                <Home className="h-4 w-4" />
                Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/noticias')} className="gap-2">
                <Newspaper className="h-4 w-4" />
                Notícias
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/language-models')} className="gap-2">
                <KeyRound className="h-4 w-4" />
                Minhas Chaves de IA
              </Button>
              {userPermissions?.isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/plans')} className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Gerenciar Planos
                </Button>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {/* Botão voltar e título */}
            <div className="flex items-center gap-4">
              {showBackButton && (
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="md:hidden">
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Voltar</span>
                </Button>
              )}
              <h1 className="text-xl font-bold text-gray-800 hidden md:block">{title}</h1>
            </div>

            {/* Botão "Atualizar Plano" */}
            {showUpgradeButton && (
              <Button variant="secondary" size="sm" onClick={() => navigate('/pricing')} className="gap-2">
                <Crown className="h-4 w-4" />
                Atualizar Plano
              </Button>
            )}

            {/* Ações e usuário */}
            <div className="flex items-center gap-2">
              {actions}
              <UserNav userProfileData={userProfileData} /> {/* Pass userProfileData to UserNav */}
            </div>
          </div>
        </div>

        {/* Título para mobile */}
        <div className="container py-2 md:hidden">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className={`flex-1 ${useContainer ? 'overflow-y-auto' : 'overflow-hidden'}`}>
        {useContainer ? (
          <div className="container py-4 sm:py-6 lg:py-8">{children}</div>
        ) : (
          children
        )}
      </main>
    </div>
  );
};