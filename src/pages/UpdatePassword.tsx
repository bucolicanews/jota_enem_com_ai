import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2 } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);

  useEffect(() => {
    // Usar onAuthStateChange é a maneira mais confiável de lidar com eventos de autenticação como a recuperação de senha
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      // O evento 'PASSWORD_RECOVERY' é emitido quando o usuário clica no link de redefinição
      if (event === 'PASSWORD_RECOVERY') {
        setSessionValid(true);
      } else if (session) {
        // Se a sessão é válida mas o evento não é de recuperação, redireciona para o dashboard
        navigate('/reset-password');
      } else {
        // Se a sessão não for válida de forma alguma, setamos a permissão como falsa
        setSessionValid(false);
      }
      setLoading(false);
    });

    // Limpa o 'ouvinte' quando o componente é desmontado para evitar vazamentos de memória
    return () => {
      authListener.subscription.unsubscribe(); // Corrigido aqui
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (password.length < 6) {
      showError('A senha deve ter pelo menos 6 caracteres.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      showError('As senhas não coincidem. Por favor, verifique.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      showError('Não foi possível atualizar sua senha. Por favor, tente novamente.');
      console.error('Password update error:', error);
    } else {
      showSuccess('Senha atualizada com sucesso! Redirecionando para o login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    }
    setLoading(false);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!sessionValid) {
    // Se a sessão não for válida, a página fica vazia ou mostra uma mensagem
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 text-center">
        <p>Aguardando a validação da sessão...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Criar Nova Senha</CardTitle>
          <CardDescription>Digite sua nova senha abaixo para acessar sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha (mínimo 6 caracteres)</Label>
              <PasswordInput
                id="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !password || !confirmPassword}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Nova Senha
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Lembrou sua senha?{' '}
            <Link to="/login" className="underline">
              Voltar para o login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UpdatePassword;