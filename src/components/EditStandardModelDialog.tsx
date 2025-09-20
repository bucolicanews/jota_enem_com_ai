import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, XCircle } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';

interface LanguageModel {
  id: string;
  user_id: string | null;
  provider: string;
  api_key: string;
  model_name: string | null;
  model_variant: string | null;
  is_active: boolean;
  is_standard: boolean;
  system_message: string | null;
  description: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface EditStandardModelDialogProps {
  model: LanguageModel | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MODEL_VARIANTS: Record<string, string[]> = {
  'Google Gemini': ['gemini-1.5-flash-latest'],
  // Adicione outros provedores e seus modelos aqui, se necessário
};

export const EditStandardModelDialog = ({ model, isOpen, onClose, onSuccess }: EditStandardModelDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelVariant, setModelVariant] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [systemMessage, setSystemMessage] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (model) {
      setProvider(model.provider);
      setModelName(model.model_name || '');
      setModelVariant(model.model_variant || '');
      setIsActive(model.is_active);
      setSystemMessage(model.system_message || '');
      setDescription(model.description || '');
      setAvatarUrl(model.avatar_url || '');
      setApiKey(''); // API key is not pre-filled for security
    } else {
      // Reset form if no model is provided (e.g., dialog opened for new creation, though this dialog is for editing)
      setProvider('Google Gemini');
      setModelName('');
      setModelVariant('');
      setIsActive(true);
      setSystemMessage('');
      setDescription('');
      setAvatarUrl('');
      setApiKey('');
    }
  }, [model]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '..';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !model) {
      showError("Nenhum arquivo selecionado.");
      return;
    }
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showError("A imagem é muito grande (máx. 5MB).");
      return;
    }
    const fileExt = file.name.split('.').pop();
    const filePath = `model_avatars/${model.id}/${Date.now()}.${fileExt}`; // Use model.id for path

    setUploading(true);
    try {
      // Delete old avatar if exists
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
    if (!model || !avatarUrl) return;

    const filePath = avatarUrl.split('/model_avatars/')[1];
    if (!filePath) {
      showError('Não foi possível identificar o arquivo a ser deletado.');
      return;
    }

    try {
      const { error: removeError } = await supabase.storage.from('model_avatars').remove([filePath]);
      if (removeError) {
        throw removeError;
      }
      setAvatarUrl('');
      showSuccess('Avatar removido.');
    } catch (error: any) {
      showError(`Erro ao deletar o avatar: ${error.message}`);
      console.error('Erro ao deletar avatar:', error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!model) return;

    setIsSubmitting(true);

    const updateData: Partial<LanguageModel> = {
      provider,
      model_name: modelName,
      model_variant: modelVariant,
      is_active: isActive,
      system_message: systemMessage,
      description,
      avatar_url: avatarUrl || null,
    };

    if (apiKey) {
      updateData.api_key = apiKey;
    }

    const { error } = await supabase
      .from('language_models')
      .update(updateData)
      .eq('id', model.id);

    if (error) {
      showError('Erro ao atualizar o agente professor.');
      console.error('Update error:', error);
    } else {
      showSuccess('Agente professor atualizado com sucesso!');
      onSuccess();
      onClose();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Agente Professor</DialogTitle>
          <DialogDescription>
            Atualize os detalhes do agente professor. Deixe a chave de API em branco para não alterá-la.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpdate} className="space-y-4 py-4">
          {/* Avatar do Agente */}
          <div className="space-y-2">
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
                disabled={uploading}
              />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Selecionar Avatar'}
              </Button>
              {avatarUrl && (
                <Button type="button" variant="ghost" size="icon" onClick={handleDeleteAvatar} disabled={uploading}>
                  <XCircle className="h-5 w-5 text-red-500" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-model-name">Nome do Agente</Label>
              <Input id="edit-model-name" value={modelName} onChange={(e) => setModelName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-provider">Provedor</Label>
              <Select value={provider} onValueChange={setProvider} disabled>
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
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-system-message">Mensagem de Sistema (Instruções para a IA)</Label>
              <Textarea
                id="edit-system-message"
                value={systemMessage}
                onChange={(e) => setSystemMessage(e.target.value)}
                placeholder="Ex: Você é um professor de matemática especializado em ENEM. Responda de forma didática..."
                rows={4}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-description">Descrição Curta (para exibição)</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Agente especializado em matemática para o ENEM."
                rows={2}
                required
              />
            </div>
            <div className="flex items-center space-x-2 md:col-span-2">
              <Switch
                id="edit-is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="edit-is-active">Ativo (Visível para usuários PRO)</Label>
            </div>
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