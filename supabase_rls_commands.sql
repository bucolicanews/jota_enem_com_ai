-- =================================================================================
-- RLS para a tabela 'language_models'
-- =================================================================================

-- Habilitar RLS na tabela language_models se ainda não estiver habilitado
ALTER TABLE public.language_models ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para evitar conflitos (ajuste conforme necessário)
DROP POLICY IF EXISTS "Users can manage their own language models" ON public.language_models;
DROP POLICY IF EXISTS "Non-admins can view active standard models" ON public.language_models;
DROP POLICY IF EXISTS "Admins/Devs can view all language models" ON public.language_models;
DROP POLICY IF EXISTS "Admins/Devs can insert standard language models" ON public.language_models;
DROP POLICY IF EXISTS "Admins/Devs can update standard language models" ON public.language_models;
DROP POLICY IF EXISTS "Admins/Devs can delete standard language models" ON public.language_models;

-- Policy 1: Permitir que usuários autenticados gerenciem seus PRÓPRIOS modelos (não padrão)
CREATE POLICY "Users can manage their own language models"
ON public.language_models
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 2: Permitir que usuários autenticados (não administradores) SELECIONEM modelos padrão ativos
CREATE POLICY "Non-admins can view active standard models"
ON public.language_models
FOR SELECT TO authenticated
USING (is_standard = TRUE AND is_active = TRUE);

-- Policy 3: Permitir que Admins/Devs SELECIONEM todos os modelos (padrão ou pessoais)
CREATE POLICY "Admins/Devs can view all language models"
ON public.language_models
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cliente
    WHERE id = auth.uid()
    AND permissao_id IN (
      SELECT id FROM public.permissoes WHERE nome = 'Admin' OR nome = 'Dev'
    )
  )
);

-- Policy 4: Permitir que Admins/Devs INSERAM modelos padrão (user_id IS NULL)
CREATE POLICY "Admins/Devs can insert standard language models"
ON public.language_models
FOR INSERT TO authenticated
WITH CHECK (
  is_standard = TRUE AND user_id IS NULL AND
  EXISTS (
    SELECT 1 FROM public.cliente
    WHERE id = auth.uid()
    AND permissao_id IN (
      SELECT id FROM public.permissoes WHERE nome = 'Admin' OR nome = 'Dev'
    )
  )
);

-- Policy 5: Permitir que Admins/Devs ATUALIZEM modelos padrão (user_id IS NULL)
CREATE POLICY "Admins/Devs can update standard language models"
ON public.language_models
FOR UPDATE TO authenticated
USING (
  is_standard = TRUE AND user_id IS NULL AND
  EXISTS (
    SELECT 1 FROM public.cliente
    WHERE id = auth.uid()
    AND permissao_id IN (
      SELECT id FROM public.permissoes WHERE nome = 'Admin' OR nome = 'Dev'
    )
  )
)
WITH CHECK (
  is_standard = TRUE AND user_id IS NULL AND
  EXISTS (
    SELECT 1 FROM public.cliente
    WHERE id = auth.uid()
    AND permissao_id IN (
      SELECT id FROM public.permissoes WHERE nome = 'Admin' OR nome = 'Dev'
    )
  )
);

-- Policy 6: Permitir que Admins/Devs DELETEM modelos padrão (user_id IS NULL)
CREATE POLICY "Admins/Devs can delete standard language models"
ON public.language_models
FOR DELETE TO authenticated
USING (
  is_standard = TRUE AND user_id IS NULL AND
  EXISTS (
    SELECT 1 FROM public.cliente
    WHERE id = auth.uid()
    AND permissao_id IN (
      SELECT id FROM public.permissoes WHERE nome = 'Admin' OR nome = 'Dev'
    )
  )
);