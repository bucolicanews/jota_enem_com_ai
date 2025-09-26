import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, PlusCircle, XCircle } from 'lucide-react';

interface LanguageModel {
  id?: string; // Optional for new models
  user_id?: string | null;
  provider: string;
  api_key: string;
  model_name: string | null;
  model_variant: string | null;
  is_active: boolean;
  is_standard: boolean;
  system_message: string | null;
  description: string | null;
  avatar_url: string | null;
}

interface AdminStandardModelFormProps {
  initialModel?: LanguageModel | null; // For edit mode
  onSubmit: (modelData: Omit<LanguageModel, 'id' | 'user_id' | 'is_standard'> & { id?: string }) => Promise<void>;
  onCancel?: () => void;
  isSubmitting: boolean;
  isAdmin: boolean;
}

const MODEL_VARIANTS: Record<string, string[]> = {
  'Google Gemini': ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest', 'gemini-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-preview', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-lite-preview', 'gemini-2.5-pro', 'gemini-2.0-flash-lite', 'gemini-2.0-flash'],
  'OpenAI': ['gpt-3.5-turbo', 'gpt-4o', 'gpt-4-turbo'],
  'Anthropic': ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  'Groq': ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768'],
  'DeepSeek': ['deepseek-chat', 'deepseek-coder'],
};

export const AdminStandardModelForm = ({
  initialModel,
  onSubmit,
  onCancel,
  isSubmitting,
  isAdmin,
}: AdminStandardModelFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState('Google Gemini');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelVariant, setModelVariant] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [systemMessage, setSystemMessage] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (initialModel) {
      setProvider(initialModel.provider);
      setModelName(initialModel.model_name || '');
      setModelVariant(initialModel.model_variant || '');
      setIsActive(initialModel.is_active);
      setSystemMessage(initialModel.system_message || '');
      setDescription(initialModel.description || '');
      setAvatarUrl(initialModel.avatar_url || '');
      setApiKey(''); // API key is not pre-filled for security
    } else {
      // Reset form for new entry
      setProvider('Google Gemini');
      setModelName('');
      setModelVariant(MODEL_VARIANTS['Google Gemini']?.[0] || '');
      setIsActive(true);
      setSystemMessage('');
      setDescription('');
      setAvatarUrl('');
      setApiKey('');
    }
  }, [initialModel]);

  useEffect(() => {
    if (provider && MODEL_VARIANTS[provider] && MODEL_VARIANTS[provider].length > 0) {
      setModelVariant(MODEL_VARIANTS[provider][0]);
    } else {
      setModelVariant('');
    }
  }, [provider]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '..';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      showError("Nenhum arquivo selecionado.");
      return;
    }
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showError("A imagem é muito grande (máx. 5MB).");
      return;
    }
    const fileExt = file.name.split('.').pop();
    const filePath = `model_avatars/${initialModel?.id || 'new'}/${Date.now()}.${fileExt}`;

    setUploading(true);
    try {
      if (avatarUrl) {
        const oldFilePath = avatarUrl.split('/model_avatars/')[1];
        if (oldFilePath) await supabase.storage.from('model_avatars').remove([oldFilePath]);
      }

      const { error: uploadError } = await supabase.storage.from('model_avatars').upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }
      const { data } = supabase.storage.from('model_avatars').getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
      showSuccess('Avatar enviado com sucesso!');
    } catch (error: any) {
      showError(`Erro no upload do avatar: ${error.message}`);
      console.error('Erro de upload:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!avatarUrl) return;

    const filePath = avatarUrl.split('/model_avatars/')[1];
    if (!filePath) {
      showError('Não foi possível identificar o arquivo a ser deletado.');
      return;
    }

    try {
      const { error: removeError } = await supabase.storage.from('model_avatars').remove([filePath]);
      if (removeError) {
        console.error('Erro ao deletar avatar do storage:', removeError);
      }
      setAvatarUrl('');
      showSuccess('Avatar removido.');
    } catch (error: any) {
      showError(`Erro ao deletar o avatar: ${error.message}`);
      console.error('Erro ao deletar avatar:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showError('Acesso negado.');
      return;
    }
    if (!provider || (!apiKey && !initialModel) || !modelName || !modelVariant || !systemMessage || !description) {
      showError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const modelData = {
      id: initialModel?.id, // Pass ID if in edit mode
      provider,
      api_key: apiKey, // Only send if changed or new
      model_name: modelName,
      model_variant: modelVariant,
      is_active: isActive,
      system_message: systemMessage,
      description,
      avatar_url: avatarUrl || null,
    };

    await onSubmit(modelData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2 md:col-span-2">
        <Label>Avatar do Agente</Label>
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 border-2">
            <AvatarImage src={avatarUrl || ''} alt={modelName || 'Agente'} />
            <AvatarFallback>{getInitials(modelName)}</AvatarFallback>
          </Avatar>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            disabled={uploading || isSubmitting}
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading || isSubmitting}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Selecionar Avatar'}
          </Button>
          {avatarUrl && (
            <Button type="button" variant="ghost" size="icon" onClick={handleDeleteAvatar} disabled={uploading || isSubmitting}>
              <XCircle className="h-5 w-5 text-red-500" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="provider">Provedor</Label>
          <Select value={provider} onValueChange={setProvider} disabled={isSubmitting}>
            <SelectTrigger id="provider">
              <SelectValue placeholder="Selecione o provedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Google Gemini">Google Gemini</SelectItem>
              <SelectItem value="OpenAI">OpenAI</SelectItem>
              <SelectItem value="Anthropic">Anthropic</SelectItem>
              <SelectItem value="Groq">Groq</SelectItem>
              <SelectItem value="DeepSeek">DeepSeek</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="model-variant">Modelo Específico</Label>
          <Select value={modelVariant} onValueChange={setModelVariant} disabled={!provider || !MODEL_VARIANTS[provider]?.length || isSubmitting}>
            <SelectTrigger id="model-variant">
              <SelectValue placeholder="Selecione o modelo" />
            </SelectTrigger>
            <SelectContent>
              {provider && MODEL_VARIANTS[provider]?.map((variant) => (
                <SelectItem key={variant} value={variant}>{variant}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="model-name">Nome do Agente</Label>
          <Input
            id="model-name"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="Ex: Professor de Matemática"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="api-key">Chave de API {initialModel ? '(Opcional, deixe em branco para não alterar)' : ''}</Label>
          <Input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Insira a chave de API"
            required={!initialModel} // Required only for new models
            autoComplete="new-password"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="system-message">Mensagem de Sistema (Instruções para a IA)</Label>
          <Textarea
            id="system-message"
            value={systemMessage}
            onChange={(e) => setSystemMessage(e.target.value)}
            placeholder="Ex: Você é um professor de matemática especializado em ENEM. Responda de forma didática..."
            rows={4}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Descrição Curta (para exibição)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Agente especializado em matemática para o ENEM."
            rows={2}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="flex items-center space-x-2 md:col-span-2">
          <Switch
            id="is-active"
            checked={isActive}
            onCheckedChange={setIsActive}
            disabled={isSubmitting}
          />
          <Label htmlFor="is-active">Ativo (Visível para usuários PRO)</Label>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialModel ? 'Salvar Alterações' : 'Adicionar Agente'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
};