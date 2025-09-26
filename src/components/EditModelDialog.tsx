import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2 } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';

interface LanguageModel {
  id: string;
  provider: string;
  api_key: string;
  model_name: string | null;
  model_variant: string | null;
  is_active: boolean;
}

interface EditModelDialogProps {
  model: LanguageModel | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MODEL_VARIANTS: Record<string, string[]> = {
  'Google Gemini': ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest', 'gemini-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-preview', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-lite-preview', 'gemini-2.5-pro', 'gemini-2.0-flash-lite', 'gemini-2.0-flash'],
  'OpenAI': ['gpt-3.5-turbo', 'gpt-4o', 'gpt-4-turbo'],
  'Anthropic': ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  'Groq': ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768'],
  'DeepSeek': ['deepseek-chat', 'deepseek-coder'],
};

export const EditModelDialog = ({ model, isOpen, onClose, onSuccess }: EditModelDialogProps) => {
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelVariant, setModelVariant] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (model) {
      setProvider(model.provider);
      setModelName(model.model_name || '');
      setModelVariant(model.model_variant || ''); // Removido o padrão inicial
      setApiKey(''); 
    } else {
      // Reset form if no model is provided
      setProvider('Google Gemini');
      setModelName('');
      setModelVariant('');
      setApiKey('');
    }
  }, [model]);

  useEffect(() => {
    // Define o primeiro modelo da lista como padrão quando o provedor muda
    if (provider && MODEL_VARIANTS[provider] && MODEL_VARIANTS[provider].length > 0) {
      setModelVariant(MODEL_VARIANTS[provider][0]);
    } else {
      setModelVariant('');
    }
  }, [provider]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!model) return;

    setIsSubmitting(true);
    
    const updateData: {
        provider: string;
        model_name: string;
        model_variant: string;
        api_key?: string;
    } = {
        provider,
        model_name: modelName,
        model_variant: modelVariant,
    };

    if (apiKey) {
        updateData.api_key = apiKey;
    }

    const { error } = await supabase
      .from('language_models')
      .update(updateData)
      .eq('id', model.id);

    if (error) {
      showError('Erro ao atualizar o modelo.');
      console.error('Update error:', error);
    } else {
      showSuccess('Modelo atualizado com sucesso!');
      onSuccess();
      onClose();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Modelo de IA</DialogTitle>
          <DialogDescription>
            Atualize os detalhes do seu modelo. Deixe a chave de API em branco para não alterá-la.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpdate} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-model-name">Nome da IA</Label>
            <Input id="edit-model-name" value={modelName} onChange={(e) => setModelName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-provider">Provedor</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="edit-provider"><SelectValue /></SelectTrigger>
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
            <Label htmlFor="edit-model-variant">Modelo Específico</Label>
            <Select value={modelVariant} onValueChange={setModelVariant} disabled={!provider || !MODEL_VARIANTS[provider]?.length}>
              <SelectTrigger id="edit-model-variant"><SelectValue /></SelectTrigger>
              <SelectContent>
                {provider && MODEL_VARIANTS[provider]?.map((variant) => (<SelectItem key={variant} value={variant}>{variant}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-api-key">Nova Chave de API (Opcional)</Label>
            <PasswordInput id="edit-api-key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="••••••••••••••••" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};