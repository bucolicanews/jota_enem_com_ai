import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { FileText, Target, BarChart3, User as UserIcon, BookCopy, KeyRound, MessageSquare, MessageCircle, Newspaper, ShieldCheck, Building2, UserPlus, GraduationCap, Users, Bot, Briefcase } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { checkUserPermissions, UserPermissions } from '@/utils/permissions';

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUserAndPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      
      setUser(user);
      const permissions = await checkUserPermissions(user.id);
      setUserPermissions(permissions);
      setLoading(false);
    };

    getUserAndPermissions();
  }, []);

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">JOTA ENEM</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* ========================================= */}
        {/* === Cards Comuns a todos os usuários (Free, Pro, Prof, Admin) === */}
        {/* ========================================= */}
        
        {/* Card Notícias e Vídeos */}
        <Link to="/noticias" className="transform hover:-translate-y-1 transition-transform duration-300">
          <Card className="bg-green-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold">Notícias e Vídeos</CardTitle>
              <Newspaper className="h-5 w-5 text-teal-500" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Fique por dentro das últimas novidades do ENEM.
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Card Meu Perfil */}
        <Link to="/perfil" className="transform hover:-translate-y-1 transition-transform duration-300">
          <Card className="bg-green-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold">Meu Perfil</CardTitle>
              <UserIcon className="h-5 w-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Gerencie suas informações e configurações.
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Card Minhas Chaves de IA (AGORA PARA TODOS) */}
        <Link to="/language-models" className="transform hover:-translate-y-1 transition-transform duration-300">
          <Card className="bg-green-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold">Minhas Chaves de IA</CardTitle>
              <KeyRound className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Gerencie suas chaves de API para IAs pessoais.
              </p>
            </CardContent>
          </Card>
        </Link>
        
        {/* Card Banco de Questões (AGORA PARA TODOS) */}
        <Link to="/question-bank" className="transform hover:-translate-y-1 transition-transform duration-300">
          <Card className="bg-green-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold">Banco de Questões</CardTitle>
              <BookCopy className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Explore e selecione questões para seus estudos.
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Card Minhas Provas (AGORA PARA TODOS) */}
        <Link to="/user-tests" className="transform hover:-translate-y-1 transition-transform duration-300">
          <Card className="bg-green-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold">Minhas Provas</CardTitle>
              <FileText className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Acesse e responda suas provas geradas.
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* ========================================= */}
        {/* === Cards Específicos para Free e superiores === */}
        {/* ========================================= */}
        {userPermissions?.isFree && (
          <Link to="/forumfree" className="transform hover:-translate-y-1 transition-transform duration-300">
            <Card className="bg-green-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">Fórum</CardTitle>
                <MessageCircle className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Participe de discussões e tire suas dúvidas.
                </p>
              </CardContent>
            </Card>
          </Link>
        )}
        
        {/* ========================================= */}
        {/* === Cards Específicos para Pro e superiores === */}
        {/* ========================================= */}
        {userPermissions?.isPro && (
          <>
            {/* Card Chat da Turma */}
            <Link to="/chat" className="transform hover:-translate-y-1 transition-transform duration-300">
              <Card className="bg-indigo-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">Chat da Turma</CardTitle>
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Converse com outros alunos em tempo real.
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Card Fórum PRO */}
            <Link to="/forum" className="transform hover:-translate-y-1 transition-transform duration-300">
              <Card className="bg-indigo-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">Fórum PRO</CardTitle>
                  <MessageCircle className="h-5 w-5 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Acesse o fórum completo com todas as funcionalidades.
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Card Simulados */}
            <Link to="/simulados" className="transform hover:-translate-y-1 transition-transform duration-300">
              <Card className="bg-indigo-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">Simulados</CardTitle>
                  <FileText className="h-5 w-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Teste seus conhecimentos com provas completas.
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Card Questões */}
            <Link to="/questoes" className="transform hover:-translate-y-1 transition-transform duration-300">
              <Card className="bg-indigo-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">Questões</CardTitle>
                  <Target className="h-5 w-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Pratique com exercícios de matérias específicas.
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Card Desempenho */}
            <Link to="/desempenho" className="transform hover:-translate-y-1 transition-transform duration-300">
              <Card className="bg-indigo-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">Desempenho</CardTitle>
                  <BarChart3 className="h-5 w-5 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Acompanhe seu progresso e evolução nos estudos.
                  </p>
                </CardContent>
              </Card>
            </Link>           

            {/* Card Agentes Professores (AGORA PARA PRO) */}
            <Link to="/standard-models" className="transform hover:-translate-y-1 transition-transform duration-300">
              <Card className="bg-indigo-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">Agentes Professores</CardTitle>
                  <Bot className="h-5 w-5 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Converse com nossos agentes de IA especializados.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </>
        )}
        
        {/* ========================================= */}
        {/* === Cards Específicos para Professor (Prof) e superiores === */}
        {/* ========================================= */}
        {userPermissions?.isProf && (
          <>
            <Link to="/admin/news" className="transform hover:-translate-y-1 transition-transform duration-300">
              <Card className="bg-purple-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">Meus Vídeos e Notícias</CardTitle>
                  <Newspaper className="h-5 w-5 text-red-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Gerenciar seus vídeos e notícias do ENEM.
                  </p>
                </CardContent>
              </Card>
            </Link>
            {/* Card Gerenciar Banco de Questões (Prof/Admin) */}
            <Link to="/admin/questions" className="transform hover:-translate-y-1 transition-transform duration-300">
              <Card className="bg-purple-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">Gerenciar Banco de Questões</CardTitle>
                  <GraduationCap className="h-5 w-5 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Adicione e edite questões para o banco de dados.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </>
        )}

        {/* ========================================= */}
        {/* === Cards Específicos para Admin (total) === */}
        {/* ========================================= */}
        {userPermissions?.isAdmin && (
          <>
            <Link to="/admin/newsAdmin" className="transform hover:-translate-y-1 transition-transform duration-300">
              <Card className="bg-amber-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">Gerenciar Videos e Notícias</CardTitle>
                  <Newspaper className="h-5 w-5 text-red-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Gerenciar notícias e vídeos dos Professores e Outros Administradores
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link to="/admin/redefinir-senha" className="transform hover:-translate-y-1 transition-transform duration-300">
              <Card className="bg-amber-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">Redefinir Senha de Usuário</CardTitle>
                  <KeyRound className="h-5 w-5 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Envie Por Email as Senhas dos Usuários.
                  </p>
                </CardContent>
              </Card>
            </Link>
            
            <Link to="/user-create" className="transform hover:-translate-y-1 transition-transform duration-300">
              <Card className="bg-amber-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">Gerenciar Usuário</CardTitle>
                  <UserPlus className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Crie novos usuários e atribua permissões.
                  </p>
                </CardContent>
              </Card>
            </Link>
            
            <Link to="/admin/companies" className="transform hover:-translate-y-1 transition-transform duration-300">
              <Card className="bg-amber-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">Cadastrar Empresa</CardTitle>
                  <Building2 className="h-5 w-5 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Gerenciar empresas, convites e licenças.
                  </p>
                </CardContent>
              </Card>
            </Link>
            
            <Link to="/admin/standard-models" className="transform hover:-translate-y-1 transition-transform duration-300">
              <Card className="bg-amber-100 hover:bg-red-200 h-full hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">Gerenciar Agentes IA</CardTitle>
                  <Bot className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Crie e configure os agentes professores de IA.
                  </p>
                </CardContent>
              </Card>
            </Link>

          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;