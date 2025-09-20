-- Tabela de Matérias (Subjects)
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.subjects
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for admin/prof" ON public.subjects
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.cliente WHERE id = auth.uid() AND (permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Admin') OR permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Prof'))));

CREATE POLICY "Allow update for admin/prof" ON public.subjects
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.cliente WHERE id = auth.uid() AND (permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Admin') OR permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Prof'))));

CREATE POLICY "Allow delete for admin/prof" ON public.subjects
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.cliente WHERE id = auth.uid() AND (permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Admin') OR permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Prof'))));


-- Tabela de Questões (Questions)
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text TEXT NOT NULL,
  options JSONB NOT NULL, -- Ex: [{"key": "A", "text": "Opção A"}, {"key": "B", "text": "Opção B"}]
  correct_answer_key TEXT NOT NULL, -- Ex: "A"
  value NUMERIC NOT NULL DEFAULT 1, -- Valor da questão
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  difficulty_level TEXT NOT NULL DEFAULT 'medium', -- Ex: 'easy', 'medium', 'hard'
  creator_id UUID REFERENCES public.cliente(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.questions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for admin/prof" ON public.questions
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.cliente WHERE id = auth.uid() AND (permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Admin') OR permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Prof'))));

CREATE POLICY "Allow update for admin/prof" ON public.questions
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.cliente WHERE id = auth.uid() AND (permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Admin') OR permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Prof'))));

CREATE POLICY "Allow delete for admin/prof" ON public.questions
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.cliente WHERE id = auth.uid() AND (permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Admin') OR permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Prof'))));


-- Tabela de Provas do Usuário (User Tests)
CREATE TABLE IF NOT EXISTS public.user_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.cliente(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed'
  score NUMERIC,
  is_auto_generated BOOLEAN DEFAULT FALSE,
  selected_question_ids UUID[] NOT NULL, -- Array de IDs das questões
  pdf_url TEXT, -- URL para o PDF gerado, se houver
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.user_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user to manage their own tests" ON public.user_tests
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- Tabela de Respostas do Usuário (User Test Answers)
CREATE TABLE IF NOT EXISTS public.user_test_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_test_id UUID REFERENCES public.user_tests(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  user_answer_key TEXT, -- Chave da opção escolhida pelo usuário (e.g., 'A', 'B')
  is_correct BOOLEAN,
  score_obtained NUMERIC,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_test_id, question_id) -- Garante que uma questão só pode ser respondida uma vez por prova
);

ALTER TABLE public.user_test_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user to manage their own test answers" ON public.user_test_answers
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_tests WHERE id = user_test_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_tests WHERE id = user_test_id AND user_id = auth.uid()));