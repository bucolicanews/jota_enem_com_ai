import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, PlusCircle, Pencil, Trash2, ShieldAlert, XCircle } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { requireProfOrAdmin } from '@/utils/permissions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

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
  subject_name?: string; // Para exibição
  difficulty_level: string;
  creator_id: string;
  created_at: string;
}

const AdminQuestions = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Form states
  const [editMode, setEditMode] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<QuestionOption[]>([
    { key: 'A', text: '' },
    { key: 'B', text: '' },
    { key: 'C', text: '' },
    { key: 'D', text: '' },
    { key: 'E', text: '' },
  ]);
  const [correctAnswerKey, setCorrectAnswerKey] = useState('');
  const [questionValue, setQuestionValue] = useState('1');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState('medium');

  // Subject management states
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

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
      setQuestions(questionsWithSubjectNames as Question[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const checkPermissionsAndFetchData = async () => {
      setCheckingPermissions(true);
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();
      if (!loggedInUser) {
        navigate('/login');
        return;
      }
      setUser(loggedInUser);
      const canAccess = await requireProfOrAdmin(loggedInUser.id);
      setHasAccess(canAccess);
      if (canAccess) {
        fetchSubjects();
        fetchQuestions();
      }
      setCheckingPermissions(false);
    };
    checkPermissionsAndFetchData();
  }, [navigate, fetchSubjects, fetchQuestions]);

  const resetForm = () => {
    setEditMode(false);
    setCurrentQuestion(null);
    setQuestionText('');
    setOptions([
      { key: 'A', text: '' },
      { key: 'B', text: '' },
      { key: 'C', text: '' },
      { key: 'D', text: '' },
      { key: 'E', text: '' },
    ]);
    setCorrectAnswerKey('');
    setQuestionValue('1');
    setSelectedSubjectId('');
    setDifficultyLevel('medium');
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index].text = value;
    setOptions(newOptions);
  };

  const handleEditClick = (question: Question) => {
    setEditMode(true);
    setCurrentQuestion(question);
    setQuestionText(question.text);
    setOptions(question.options);
    setCorrectAnswerKey(question.correct_answer_key);
    setQuestionValue(question.value.toString());
    setSelectedSubjectId(question.subject_id);
    setDifficultyLevel(question.difficulty_level);
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !hasAccess) {
      showError('Acesso negado.');
      return;
    }
    if (!questionText.trim() || options.some(opt => !opt.text.trim()) || !correctAnswerKey || !questionValue || !selectedSubjectId) {
      showError('Por favor, preencha todos os campos da questão e todas as opções.');
      return;
    }

    setIsSubmitting(true);
    const questionData = {
      text: questionText,
      options,
      correct_answer_key: correctAnswerKey,
      value: parseFloat(questionValue),
      subject_id: selectedSubjectId,
      difficulty_level: difficultyLevel,
      creator_id: user.id,
    };

    let error = null;
    if (editMode && currentQuestion) {
      const { error: updateError } = await supabase
        .from('questions')
        .update(questionData)
        .eq('id', currentQuestion.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('questions')
        .insert(questionData);
      error = insertError;
    }

    if (error) {
      showError(`Erro ao ${editMode ? 'atualizar' : 'adicionar'} questão: ${error.message}`);
      console.error('Submit question error:', error);
    } else {
      showSuccess(`Questão ${editMode ? 'atualizada' : 'adicionada'} com sucesso!`);
      resetForm();
      fetchQuestions();
    }
    setIsSubmitting(false);
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!user || !hasAccess) {
      showError('Acesso negado.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja deletar esta questão?')) return;

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id);

    if (error) {
      showError(`Erro ao deletar questão: ${error.message}`);
      console.error('Delete question error:', error);
    } else {
      showSuccess('Questão deletada com sucesso!');
      fetchQuestions();
    }
  };

  // Subject management handlers
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) {
      showError('O nome da matéria não pode ser vazio.');
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.from('subjects').insert({ name: newSubjectName.trim() });
    if (error) {
      showError(`Erro ao adicionar matéria: ${error.message}`);
    } else {
      showSuccess('Matéria adicionada com sucesso!');
      setNewSubjectName('');
      fetchSubjects();
      setIsSubjectDialogOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setNewSubjectName(subject.name);
    setIsSubjectDialogOpen(true);
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !newSubjectName.trim()) {
      showError('O nome da matéria não pode ser vazio.');
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase
      .from('subjects')
      .update({ name: newSubjectName.trim() })
      .eq('id', editingSubject.id);
    if (error) {
      showError(`Erro ao atualizar matéria: ${error.message}`);
    } else {
      showSuccess('Matéria atualizada com sucesso!');
      setEditingSubject(null);
      setNewSubjectName('');
      fetchSubjects();
      setIsSubjectDialogOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleDeleteSubject = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja deletar esta matéria? Todas as questões associadas terão sua matéria removida.')) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) {
      showError(`Erro ao deletar matéria: ${error.message}`);
    } else {
      showSuccess('Matéria deletada com sucesso!');
      fetchSubjects();
    }
    setIsSubmitting(false);
  };

  if (checkingPermissions) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive"><ShieldAlert className="h-12 w-12 mx-auto mb-4" />Acesso Negado</CardTitle>
            <CardDescription className="text-center">Apenas professores e administradores podem acessar esta página.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/dashboard')}>Voltar para o Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
      <h1 className="text-3xl font-bold">Gerenciar Banco de Questões</h1>

      {/* Card para Adicionar/Editar Questão */}
      <Card>
        <CardHeader>
          <CardTitle>{editMode ? 'Editar Questão' : 'Adicionar Nova Questão'}</CardTitle>
          <CardDescription>
            {editMode ? 'Atualize os detalhes da questão existente.' : 'Crie uma nova questão para o banco de dados.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitQuestion} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question-text">Texto da Questão</Label>
              <Textarea
                id="question-text"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Digite o enunciado completo da questão..."
                rows={6}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {options.map((option, index) => (
                <div key={option.key} className="space-y-2">
                  <Label htmlFor={`option-${option.key}`}>Opção {option.key}</Label>
                  <Input
                    id={`option-${option.key}`}
                    value={option.text}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Texto da opção ${option.key}`}
                    required
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="correct-answer">Resposta Correta</Label>
                <Select value={correctAnswerKey} onValueChange={setCorrectAnswerKey} required>
                  <SelectTrigger id="correct-answer"><SelectValue placeholder="Selecione a correta" /></SelectTrigger>
                  <SelectContent>
                    {options.map(opt => opt.text.trim() && <SelectItem key={opt.key} value={opt.key}>{opt.key}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="question-value">Valor (Pontos)</Label>
                <Input
                  id="question-value"
                  type="number"
                  value={questionValue}
                  onChange={(e) => setQuestionValue(e.target.value)}
                  min="0.1"
                  step="0.1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="difficulty-level">Nível de Dificuldade</Label>
                <Select value={difficultyLevel} onValueChange={setDifficultyLevel} required>
                  <SelectTrigger id="difficulty-level"><SelectValue placeholder="Selecione o nível" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Fácil</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="hard">Difícil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Matéria</Label>
              <div className="flex gap-2">
                <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId} required>
                  <SelectTrigger id="subject"><SelectValue placeholder="Selecione a matéria" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(subject => (
                      <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => { setEditingSubject(null); setNewSubjectName(''); }}>
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingSubject ? 'Editar Matéria' : 'Adicionar Nova Matéria'}</DialogTitle>
                      <DialogDescription>
                        {editingSubject ? 'Altere o nome da matéria.' : 'Adicione uma nova matéria para categorizar as questões.'}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={editingSubject ? handleUpdateSubject : handleAddSubject} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="subject-name">Nome da Matéria</Label>
                        <Input
                          id="subject-name"
                          value={newSubjectName}
                          onChange={(e) => setNewSubjectName(e.target.value)}
                          placeholder="Ex: Matemática, Português"
                          required
                        />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsSubjectDialogOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {editingSubject ? 'Salvar Alterações' : 'Adicionar Matéria'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editMode ? 'Salvar Alterações' : 'Adicionar Questão'}
              </Button>
              {editMode && (
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                  Cancelar Edição
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Card para Gerenciar Matérias */}
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Matérias</CardTitle>
          <CardDescription>Adicione, edite ou remova as categorias de matérias.</CardDescription>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Nenhuma matéria cadastrada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Matéria</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map(subject => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditSubject(subject)}>
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteSubject(subject.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Card para Listar Questões */}
      <Card>
        <CardHeader>
          <CardTitle>Questões Cadastradas</CardTitle>
          <CardDescription>Visualize e gerencie todas as questões no banco de dados.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8">
              <XCircle className="h-12 w-12 mb-4 text-gray-400" />
              <p>Nenhuma questão encontrada.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Questão</TableHead>
                  <TableHead>Matéria</TableHead>
                  <TableHead>Dificuldade</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map(question => (
                  <TableRow key={question.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{question.text}</TableCell>
                    <TableCell>{question.subject_name}</TableCell>
                    <TableCell>{question.difficulty_level}</TableCell>
                    <TableCell>{question.value}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(question)}>
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(question.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
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

export default AdminQuestions;