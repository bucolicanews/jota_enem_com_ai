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
  'Google Gemini': ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-1.0-pro'],
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
      setModelVariant(model.model_variant || '');
      setApiKey(''); 
    }
  }, [model]);

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
            <Select value={provider} onValueChange={setProvider} disabled> {/* Desabilitado para ser apenas Gemini */}
              <SelectTrigger id="edit-provider"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Google Gemini">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-model-variant">Modelo Específico</Label>
            <Select value={modelVariant} onValueChange={setModelVariant} disabled={!provider}>
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