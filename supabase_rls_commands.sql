-- Habilitar RLS para a tabela ai_conversations
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Política para SELECT em ai_conversations: Usuários podem ver suas próprias conversas
CREATE POLICY "Users can view their own AI conversations."
ON public.ai_conversations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Política para INSERT em ai_conversations: Usuários podem criar suas próprias conversas
CREATE POLICY "Users can create their own AI conversations."
ON public.ai_conversations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Política para UPDATE em ai_conversations: Usuários podem atualizar suas próprias conversas (ex: título, updated_at)
CREATE POLICY "Users can update their own AI conversations."
ON public.ai_conversations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política para DELETE em ai_conversations: Usuários podem deletar suas próprias conversas
CREATE POLICY "Users can delete their own AI conversations."
ON public.ai_conversations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Habilitar RLS para a tabela ai_chat_messages
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Política para SELECT em ai_chat_messages: Usuários podem ver mensagens de suas próprias conversas
CREATE POLICY "Users can view messages from their own AI conversations."
ON public.ai_chat_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ai_conversations
    WHERE ai_conversations.id = ai_chat_messages.conversation_id
    AND ai_conversations.user_id = auth.uid()
  )
);

-- Política para INSERT em ai_chat_messages: Usuários podem adicionar mensagens às suas próprias conversas
CREATE POLICY "Users can insert messages into their own AI conversations."
ON public.ai_chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.ai_conversations
    WHERE ai_conversations.id = ai_chat_messages.conversation_id
    AND ai_conversations.user_id = auth.uid()
  )
);

-- Política para DELETE em ai_chat_messages: Usuários podem deletar mensagens de suas próprias conversas
CREATE POLICY "Users can delete messages from their own AI conversations."
ON public.ai_chat_messages FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ai_conversations
    WHERE ai_conversations.id = ai_chat_messages.conversation_id
    AND ai_conversations.user_id = auth.uid()
  )
);