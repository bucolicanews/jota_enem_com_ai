import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { checkUserPermissions, UserPermissions } from '@/utils/permissions';
import { Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: 'Free' | 'Pro' | 'Prof' | 'Admin';
  requiredFeature?: 'pro' | 'prof' | 'content' | 'users' | 'admin';
}

export const ProtectedRoute = ({
  children,
  requiredPermission = 'Free',
  requiredFeature 
}: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      const permissions = await checkUserPermissions(user.id);
      
      // LOG DE VERIFICAÇÃO DE PERMISSÕES
      console.log('Permissões do usuário:', permissions);

      let access = false;
      
      if (requiredFeature) {
        switch (requiredFeature) {
          case 'pro':
            access = permissions.isPro;
            break;
          case 'prof':
            access = permissions.isProf;
            break;
          case 'content':
            access = permissions.isProf;
            break;
          case 'users':
            access = permissions.isProf;
            break;
          case 'admin':
            access = permissions.isAdmin;
            break;
          default:
            access = false;
        }
      } else {
        const permissionLevels = ['Free', 'Pro', 'Prof', 'Admin'];
        const userLevel = permissionLevels.indexOf(permissions.name);
        const requiredLevel = permissionLevels.indexOf(requiredPermission);
        
        access = userLevel >= requiredLevel;
      }

      if (!access) {
        showError('Acesso negado. Você não tem permissão para acessar esta página.');
        navigate('/dashboard');
        return;
      }

      setHasAccess(true);
    };

    checkAccess();
  }, [navigate, requiredPermission, requiredFeature]);

  if (hasAccess === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
};
