-- Alterar a tabela language_models para incluir campos para modelos padrão
ALTER TABLE public.language_models
ADD COLUMN is_standard BOOLEAN DEFAULT FALSE,
ADD COLUMN system_message TEXT,
ADD COLUMN description TEXT,
ADD COLUMN avatar_url TEXT;

-- Criar a tabela model_documents para associar documentos aos modelos
CREATE TABLE public.model_documents (
    model_id UUID REFERENCES public.language_models(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (model_id, document_id)
);

-- Políticas de RLS (Row Level Security) para language_models
-- Remover políticas existentes se houver conflito e recriar com as novas regras
DROP POLICY IF EXISTS "Enable read access for own models or standard models" ON public.language_models;
DROP POLICY IF EXISTS "Enable insert for authenticated users for non-standard models" ON public.language_models;
DROP POLICY IF EXISTS "Enable update for own models or admin for standard models" ON public.language_models;
DROP POLICY IF EXISTS "Enable delete for own models or admin for standard models" ON public.language_models;

-- Permitir que usuários autenticados vejam seus próprios modelos ou modelos padrão
CREATE POLICY "Enable read access for own models or standard models"
ON public.language_models
FOR SELECT
USING (
    (auth.uid() = user_id) OR (is_standard = TRUE)
);

-- Permitir que usuários autenticados insiram seus próprios modelos (não padrão)
CREATE POLICY "Enable insert for authenticated users for non-standard models"
ON public.language_models
FOR INSERT
WITH CHECK (
    (auth.uid() = user_id) AND (is_standard = FALSE)
);

-- Permitir que usuários autenticados atualizem seus próprios modelos (não padrão)
-- Permitir que administradores atualizem modelos padrão
CREATE POLICY "Enable update for own models or admin for standard models"
ON public.language_models
FOR UPDATE
USING (
    (auth.uid() = user_id AND is_standard = FALSE) OR
    (EXISTS (SELECT 1 FROM public.cliente WHERE id = auth.uid() AND permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Admin'))) AND (is_standard = TRUE)
)
WITH CHECK (
    (auth.uid() = user_id AND is_standard = FALSE) OR
    (EXISTS (SELECT 1 FROM public.cliente WHERE id = auth.uid() AND permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Admin'))) AND (is_standard = TRUE)
);

-- Permitir que usuários autenticados deletem seus próprios modelos (não padrão)
-- Permitir que administradores deletem modelos padrão
CREATE POLICY "Enable delete for own models or admin for standard models"
ON public.language_models
FOR DELETE
USING (
    (auth.uid() = user_id AND is_standard = FALSE) OR
    (EXISTS (SELECT 1 FROM public.cliente WHERE id = auth.uid() AND permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Admin'))) AND (is_standard = TRUE)
);

-- Políticas de RLS para model_documents
-- Permitir que administradores insiram/deletem
CREATE POLICY "Enable all access for admins on model_documents"
ON public.model_documents
FOR ALL
USING (
    EXISTS (SELECT 1 FROM public.cliente WHERE id = auth.uid() AND permissao_id = (SELECT id FROM public.permissoes WHERE nome = 'Admin'))
);

-- Permitir que usuários Pro (e superiores) selecionem (para buscar contexto na Edge Function)
CREATE POLICY "Enable select for Pro users on model_documents"
ON public.model_documents
FOR SELECT
USING (
    EXISTS (SELECT 1 FROM public.cliente WHERE id = auth.uid() AND permissao_id IN (SELECT id FROM public.permissoes WHERE nome IN ('Pro', 'Prof', 'Admin')))
);