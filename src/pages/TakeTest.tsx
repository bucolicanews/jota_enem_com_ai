import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, CheckCircle, XCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

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
  subject_name?: string;
  difficulty_level: string; // Adicionado
}

interface UserTest {
  id: string;
  user_id: string;
  title: string;
  generated_at: string;
  status: 'pending' | 'completed';
  score: number | null;
  is_auto_generated: boolean;
  selected_question_ids: string[];
}

interface UserAnswer {
  question_id: string;
  user_answer_key: string;
  is_correct?: boolean;
  score_obtained?: number;
}

const TakeTest = () => {
  const navigate = useNavigate();
  const { testId } = useParams<{ testId?: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [currentTest, setCurrentTest] = useState<UserTest | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const fetchTestAndQuestions = useCallback(async (testId: string, userId: string) => {
    setLoading(true);
    // Fetch test details
    const { data: testData, error: testError } = await supabase
      .from('user_tests')
      .select('*')
      .eq('id', testId)
      .eq('user_id', userId)
      .single();

    if (testError || !testData) {
      console.error('Error fetching test:', testError);
      showError('Prova não encontrada ou acesso negado.');
      navigate('/question-bank'); // Redireciona para o banco de questões
      setLoading(false);
      return;
    }
    setCurrentTest(testData);

    // Fetch questions for the test
    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('*, subjects(name)')
      .in('id', testData.selected_question_ids)
      .order('created_at', { ascending: true }); // Ordenar para manter a ordem consistente

    if (questionsError || !questionsData) {
      console.error('Error fetching questions for test:', questionsError);
      showError('Erro ao carregar questões da prova.');
      setLoading(false);
      return;
    }

    const questionsWithSubjectNames = questionsData.map((q: any) => ({
      ...q,
      subject_name: q.subjects?.name || 'N/A',
    }));
    setQuestions(questionsWithSubjectNames as Question[]);

    // If test is already completed, fetch answers and show results
    if (testData.status === 'completed') {
      const { data: answersData, error: answersError } = await supabase
        .from('user_test_answers')
        .select('question_id, user_answer_key, is_correct, score_obtained')
        .eq('user_test_id', testId);

      if (answersError) {
        console.error('Error fetching answers:', answersError);
        showError('Erro ao carregar respostas anteriores.');
      } else {
        setUserAnswers(answersData || []);
      }
      setShowResults(true);
    } else {
      // Initialize user answers for a new test
      const initialAnswers = questionsWithSubjectNames.map(q => ({
        question_id: q.id,
        user_answer_key: '',
      }));
      setUserAnswers(initialAnswers);
    }

    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();
      if (!loggedInUser) {
        navigate('/login');
        return;
      }
      setUser(loggedInUser);
      if (testId) {
        fetchTestAndQuestions(testId, loggedInUser.id);
      } else {
        showError('Nenhuma prova selecionada.');
        navigate('/question-bank');
      }
    };
    getUser();
  }, [navigate, testId, fetchTestAndQuestions]);

  const handleAnswerChange = (questionId: string, answerKey: string) => {
    setUserAnswers(prev =>
      prev.map(ans =>
        ans.question_id === questionId ? { ...ans, user_answer_key: answerKey } : ans
      )
    );
  };

  const handleSubmitTest = async () => {
    if (!user || !currentTest) return;

    setIsSubmitting(true);
    let totalScore = 0;
    const answersToInsert = userAnswers.map(userAns => {
      const question = questions.find(q => q.id === userAns.question_id);
      if (!question) return null;

      const isCorrect = userAns.user_answer_key === question.correct_answer_key;
      const scoreObtained = isCorrect ? question.value : 0;
      totalScore += scoreObtained;

      return {
        user_test_id: currentTest.id,
        question_id: question.id, // Usar question.id para garantir que é o ID correto
        user_answer_key: userAns.user_answer_key,
        is_correct: isCorrect,
        score_obtained: scoreObtained,
      };
    }).filter(Boolean); // Remove nulls

    try {
      // Insert answers
      const { error: insertError } = await supabase
        .from('user_test_answers')
        .insert(answersToInsert);

      if (insertError) throw insertError;

      // Update test status and score
      const { error: updateError } = await supabase
        .from('user_tests')
        .update({ status: 'completed', score: totalScore })
        .eq('id', currentTest.id);

      if (updateError) throw updateError;

      showSuccess('Prova finalizada e respostas salvas!');
      setShowResults(true);
      setCurrentTest(prev => prev ? { ...prev, status: 'completed', score: totalScore } : null);
    } catch (error: any) {
      showError(`Erro ao finalizar prova: ${error.message}`);
      console.error('Submit test error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const userAnswerForCurrentQuestion = userAnswers.find(ans => ans.question_id === currentQuestion?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!currentTest || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Nenhuma prova para exibir</h1>
        <p className="text-muted-foreground mb-6">Parece que não há provas disponíveis ou selecionadas.</p>
        <Button onClick={() => navigate('/question-bank')}>Ir para o Banco de Questões</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{currentTest.title}</h1>
        <Button variant="outline" onClick={() => navigate('/user-tests')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Minhas Provas
        </Button>
      </div>

      {showResults ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Resultados da Prova</CardTitle>
            <CardDescription>Você finalizou a prova em {new Date(currentTest.generated_at).toLocaleDateString('pt-BR')}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center text-lg font-semibold">
              Sua pontuação: <span className="text-primary text-3xl">{currentTest.score}</span> / {questions.reduce((sum, q) => sum + q.value, 0)}
            </div>
            <Separator />
            {questions.map((question, index) => {
              const userAnswer = userAnswers.find(ans => ans.question_id === question.id);
              const isCorrect = userAnswer?.is_correct;
              const userSelectedKey = userAnswer?.user_answer_key;

              return (
                <div key={question.id} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    {isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <h3 className="font-semibold text-lg">Questão {index + 1}: {question.text}</h3>
                  </div>
                  <div className="space-y-2 text-sm ml-7">
                    {question.options.map(option => (
                      <p key={option.key} className={
                        option.key === question.correct_answer_key
                          ? 'font-bold text-green-600'
                          : option.key === userSelectedKey && !isCorrect
                            ? 'font-bold text-red-600'
                            : ''
                      }>
                        <strong>{option.key})</strong> {option.text}
                        {option.key === question.correct_answer_key && ' (Correta)'}
                        {option.key === userSelectedKey && !isCorrect && ' (Sua Resposta)'}
                      </p>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 ml-7">
                    Matéria: {question.subject_name} | Dificuldade: {question.difficulty_level} | Valor: {question.value}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Questão {currentQuestionIndex + 1} de {questions.length}</CardTitle>
            <CardDescription>Selecione a alternativa correta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentQuestion && (
              <>
                <p className="text-lg font-medium">{currentQuestion.text}</p>
                <RadioGroup
                  value={userAnswerForCurrentQuestion?.user_answer_key || ''}
                  onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                >
                  {currentQuestion.options.map(option => (
                    <div key={option.key} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.key} id={`option-${option.key}`} />
                      <Label htmlFor={`option-${option.key}`}>{option.key}) {option.text}</Label>
                    </div>
                  ))}
                </RadioGroup>
                <div className="flex justify-between mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestionIndex === 0}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Anterior
                  </Button>
                  {currentQuestionIndex < questions.length - 1 ? (
                    <Button
                      onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                      disabled={!userAnswerForCurrentQuestion?.user_answer_key}
                    >
                      Próxima <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button onClick={handleSubmitTest} disabled={isSubmitting || !userAnswerForCurrentQuestion?.user_answer_key}>
                      {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Finalizar Prova
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TakeTest;