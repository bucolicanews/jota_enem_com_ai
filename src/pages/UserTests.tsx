import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Play, Eye, Trash2, FileText, XCircle, PlusCircle, Download } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface UserTest {
  id: string;
  user_id: string;
  title: string;
  generated_at: string;
  status: 'pending' | 'completed';
  score: number | null;
  is_auto_generated: boolean;
  selected_question_ids: string[];
  pdf_url: string | null;
}

const UserTests = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userTests, setUserTests] = useState<UserTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUserTests = useCallback(async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_tests')
      .select('*')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false });

    if (error) {
      console.error('Error fetching user tests:', error);
      showError('Erro ao carregar suas provas.');
    } else {
      setUserTests(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();
      if (!loggedInUser) {
        navigate('/login');
        return;
      }
      setUser(loggedInUser);
      fetchUserTests(loggedInUser.id);
    };
    getUser();
  }, [navigate, fetchUserTests]);

  const handleTakeTest = (testId: string) => {
    navigate(`/take-test/${testId}`);
  };

  const handleDeleteTest = async (testId: string) => {
    if (!window.confirm('Tem certeza que deseja deletar esta prova e todas as suas respostas? Esta ação é irreversível.')) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('user_tests')
        .delete()
        .eq('id', testId)
        .eq('user_id', user?.id); // Garante que o usuário só pode deletar suas próprias provas

      if (error) throw error;

      showSuccess('Prova deletada com sucesso!');
      if (user) fetchUserTests(user.id);
    } catch (error: any) {
      showError(`Erro ao deletar prova: ${error.message}`);
      console.error('Delete test error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadPdf = async (test: UserTest) => {
    if (!test.pdf_url) {
      showError('PDF não disponível para esta prova.');
      return;
    }
    // TODO: Implementar lógica de download de PDF real
    window.open(test.pdf_url, '_blank');
    showSuccess('Download do PDF iniciado (funcionalidade em desenvolvimento)!');
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <h1 className="text-3xl font-bold">Minhas Provas</h1>
      <p className="text-muted-foreground">
        Aqui você pode ver as provas que gerou, respondê-las ou revisar seus resultados.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Provas Geradas</CardTitle>
          <CardDescription>Lista de todas as suas provas.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : userTests.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8">
              <XCircle className="h-12 w-12 mb-4 text-gray-400" />
              <p>Você ainda não gerou nenhuma prova.</p>
              <Button onClick={() => navigate('/question-bank')} className="mt-4">
                <PlusCircle className="h-4 w-4 mr-2" /> Gerar Minha Primeira Prova
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título da Prova</TableHead>
                  <TableHead>Gerada em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pontuação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userTests.map(test => (
                  <TableRow key={test.id}>
                    <TableCell className="font-medium">{test.title}</TableCell>
                    <TableCell>{new Date(test.generated_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        test.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {test.status === 'completed' ? 'Finalizada' : 'Pendente'}
                      </span>
                    </TableCell>
                    <TableCell>{test.score !== null ? `${test.score} pontos` : '-'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTakeTest(test.id)}
                        disabled={isDeleting}
                        aria-label={test.status === 'completed' ? 'Ver Resultados' : 'Responder Prova'}
                      >
                        {test.status === 'completed' ? <Eye className="h-4 w-4 text-blue-500" /> : <Play className="h-4 w-4 text-green-500" />}
                      </Button>
                      {test.pdf_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadPdf(test)}
                          disabled={isDeleting}
                          aria-label="Baixar PDF"
                        >
                          <Download className="h-4 w-4 text-purple-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTest(test.id)}
                        disabled={isDeleting}
                        aria-label="Excluir Prova"
                      >
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-500" />}
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

export default UserTests;