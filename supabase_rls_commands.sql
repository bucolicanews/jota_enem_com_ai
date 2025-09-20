-- Habilitar RLS para a tabela ai_conversations
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: Usuários podem ver suas próprias conversas de IA
CREATE POLICY "Users can view their own AI conversations."
ON public.ai_conversations
FOR SELECT
USING (auth.uid() = user_id);

-- Política para INSERT: Usuários podem criar suas próprias conversas de IA
CREATE POLICY "Users can create their own AI conversations."
ON public.ai_conversations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política para UPDATE: Usuários podem atualizar suas próprias conversas de IA (ex: título, updated_at)
CREATE POLICY "Users can update their own AI conversations."
ON public.ai_conversations
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política para DELETE: Usuários podem deletar suas próprias conversas de IA
CREATE POLICY "Users can delete their own AI conversations."
ON public.ai_conversations
FOR DELETE
USING (auth.uid() = user_id);

-- Habilitar RLS para a tabela ai_chat_messages
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: Usuários podem ver mensagens em suas próprias conversas de IA
CREATE POLICY "Users can view messages in their own AI conversations."
ON public.ai_chat_messages
FOR SELECT
USING (EXISTS (SELECT 1 FROM public.ai_conversations WHERE id = conversation_id AND user_id = auth.uid()));

-- Política para INSERT: Usuários podem inserir mensagens em suas próprias conversas de IA
CREATE POLICY "Users can insert messages into their own AI conversations."
ON public.ai_chat_messages
FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations WHERE id = conversation_id AND user_id = auth.uid()));

-- Política para DELETE: Usuários podem deletar mensagens em suas próprias conversas de IA
CREATE POLICY "Users can delete messages in their own AI conversations."
ON public.ai_chat_messages
FOR DELETE
USING (EXISTS (SELECT 1 FROM public.ai_conversations WHERE id = conversation_id AND user_id = auth.uid()));