import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, FileText, Download, Printer, PlusCircle, BookOpen, ShieldAlert, XCircle } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { checkUserPermissions, UserPermissions } from '@/utils/permissions';
import { GenerateTestDialog } from '@/components/GenerateTestDialog'; // Será criado no próximo passo

interface Subject {
  id: string;
  name: string;
}

interface QuestionOption {
  key: string;
  text: string;
}

interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
  correct_answer_key: string;
  value: number;
  subject_id: string;
  subject_name?: string;
  difficulty_level: string;
  creator_id: string;
  created_at: string;
}

const QuestionBank = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingPermissions, setCheckingPermissions] = useState(true);

  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]); // IDs das questões selecionadas

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');

  // Diálogo de geração de prova
  const [isGenerateTestDialogOpen, setIsGenerateTestDialogOpen] = useState(false);

  const fetchSubjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      console.error('Error fetching subjects:', error);
      showError('Erro ao carregar matérias.');
    } else {
      setSubjects(data || []);
    }
  }, []);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('questions')
      .select('*, subjects(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching questions:', error);
      showError('Erro ao carregar questões.');
    } else {
      const questionsWithSubjectNames = data.map((q: any) => ({
        ...q,
        subject_name: q.subjects?.name || 'N/A',
      }));
      setAllQuestions(questionsWithSubjectNames as Question[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      setCheckingPermissions(true);
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();
      if (!loggedInUser) {
        navigate('/login');
        return;
      }
      setUser(loggedInUser);
      const permissions = await checkUserPermissions(loggedInUser.id);
      setUserPermissions(permissions);
      
      fetchSubjects();
      fetchQuestions();
      setCheckingPermissions(false);
    };
    checkUserAndFetchData();
  }, [navigate, fetchSubjects, fetchQuestions]);

  const filteredQuestions = useMemo(() => {
    let filtered = allQuestions;

    if (searchTerm) {
      const lowerCaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(q =>
        q.text.toLowerCase().includes(lowerCaseSearch) ||
        q.subject_name?.toLowerCase().includes(lowerCaseSearch)
      );
    }

    if (filterSubject !== 'all') {
      filtered = filtered.filter(q => q.subject_id === filterSubject);
    }

    if (filterDifficulty !== 'all') {
      filtered = filtered.filter(q => q.difficulty_level === filterDifficulty);
    }

    return filtered;
  }, [allQuestions, searchTerm, filterSubject, filterDifficulty]);

  const handleSelectQuestion = (questionId: string, isChecked: boolean) => {
    setSelectedQuestions(prev =>
      isChecked ? [...prev, questionId] : prev.filter(id => id !== questionId)
    );
  };

  const handleSelectAllQuestions = (isChecked: boolean) => {
    if (isChecked) {
      setSelectedQuestions(filteredQuestions.map(q => q.id));
    } else {
      setSelectedQuestions([]);
    }
  };

  const handleGeneratePdf = async (questionIds: string[], includeAnswers: boolean) => {
    if (questionIds.length === 0) {
      showError('Selecione pelo menos uma questão para gerar o PDF.');
      return;
    }

    showSuccess('Gerando PDF... Isso pode levar alguns segundos.');
    // TODO: Implementar a lógica real de geração de PDF aqui
    // Por enquanto, apenas um placeholder
    console.log('Gerar PDF para questões:', questionIds, 'Incluir respostas:', includeAnswers);
    showSuccess('PDF gerado (funcionalidade em desenvolvimento)!');
  };

  if (checkingPermissions) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!userPermissions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive"><ShieldAlert className="h-12 w-12 mx-auto mb-4" />Erro de Permissão</CardTitle>
            <CardDescription className="text-center">Não foi possível verificar suas permissões. Por favor, tente novamente.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/login')}>Fazer Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isProOrHigher = userPermissions.isPro || userPermissions.isProf || userPermissions.isAdmin;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <h1 className="text-3xl font-bold">Banco de Questões</h1>
      <p className="text-muted-foreground">
        Explore e selecione questões para seus estudos.
        {userPermissions.isFree && " Usuários PRO podem gerar provas e PDFs com gabarito."}
      </p>

      {/* Filtros e Ações */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Buscar por texto da questão ou matéria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow"
            />
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filtrar por Matéria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Matérias</SelectItem>
                {subjects.map(subject => (
                  <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
              <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filtrar por Dificuldade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Dificuldades</SelectItem>
                <SelectItem value="easy">Fácil</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="hard">Difícil</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={selectedQuestions.length === filteredQuestions.length && filteredQuestions.length > 0}
                onCheckedChange={(checked: boolean) => handleSelectAllQuestions(checked)}
                disabled={filteredQuestions.length === 0}
              />
              <Label htmlFor="select-all">Selecionar Todos ({selectedQuestions.length})</Label>
            </div>

            <div className="flex flex-wrap gap-2">
              {isProOrHigher ? (
                <>
                  <Button
                    onClick={() => setIsGenerateTestDialogOpen(true)}
                    disabled={selectedQuestions.length === 0}
                  >
                    <BookOpen className="h-4 w-4 mr-2" /> Gerar Prova
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleGeneratePdf(selectedQuestions, true)}
                    disabled={selectedQuestions.length === 0}
                  >
                    <Printer className="h-4 w-4 mr-2" /> Imprimir (com gabarito)
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => handleGeneratePdf(selectedQuestions, false)}
                  disabled={selectedQuestions.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" /> Baixar Questões (PDF)
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Questões */}
      <Card>
        <CardHeader>
          <CardTitle>Questões Disponíveis</CardTitle>
          <CardDescription>Selecione as questões para sua prova ou estudo.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8">
              <XCircle className="h-12 w-12 mb-4 text-gray-400" />
              <p>Nenhuma questão encontrada com os filtros aplicados.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredQuestions.map(question => (
                <div key={question.id} className="flex items-start space-x-4 p-4 border rounded-lg shadow-sm">
                  <Checkbox
                    id={`question-${question.id}`}
                    checked={selectedQuestions.includes(question.id)}
                    onCheckedChange={(checked: boolean) => handleSelectQuestion(question.id, checked)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor={`question-${question.id}`} className="font-semibold text-base cursor-pointer">
                      {question.text}
                    </Label>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {question.options.map(option => (
                        <p key={option.key}>
                          <strong>{option.key})</strong> {option.text}
                        </p>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 bg-gray-100 rounded-full">Matéria: {question.subject_name}</span>
                      <span className="px-2 py-1 bg-gray-100 rounded-full">Dificuldade: {question.difficulty_level}</span>
                      <span className="px-2 py-1 bg-gray-100 rounded-full">Valor: {question.value}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de Geração de Prova */}
      {user && userPermissions && (
        <GenerateTestDialog
          isOpen={isGenerateTestDialogOpen}
          onClose={() => setIsGenerateTestDialogOpen(false)}
          onSuccess={() => {
            setIsGenerateTestDialogOpen(false);
            setSelectedQuestions([]); // Limpa as seleções após gerar a prova
            navigate('/take-test'); // Redireciona para a página de provas do usuário
          }}
          userId={user.id}
          selectedQuestions={selectedQuestions}
          subjects={subjects}
          isProOrHigher={isProOrHigher}
        />
      )}
    </div>
  );
};

export default QuestionBank;