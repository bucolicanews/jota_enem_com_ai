import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, PlusCircle, Pencil, Trash2, TestTube, MessageSquareText, Bot, Image as ImageIcon } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { requireAdmin } from '@/utils/permissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MultiSelect } from '@/components/ui/multi-select';

interface LanguageModel {
  id: string;
  user_id: string | null; // Pode ser null para modelos padrão
  provider: string;
  api_key: string;
  model_name: string | null;
  model_variant: string | null;
  is_active: boolean;
  is_standard: boolean; // Novo campo
  system_message: string | null; // Novo campo
  description: string | null; // Novo campo
  avatar_url: string | null; // Novo campo
  created_at: string;
  documents?: DocumentItem[]; // Documentos associados
}

interface DocumentItem {
  id: string;
  file_name: string;
  file_path: string;
}

const MODEL_VARIANTS: Record<string, string[]> = {
  'Google Gemini': ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-1.0-pro'],
};

const AdminStandardModels = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [models, setModels] = useState<LanguageModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [currentModel, setCurrentModel] = useState<LanguageModel | null>(null);

  // Form states
  const [provider, setProvider] = useState('Google Gemini');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelVariant, setModelVariant] = useState('');
  const [systemMessage, setSystemMessage] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [availableDocuments, setAvailableDocuments] = useState<DocumentItem[]>([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('language_models')
      .select('*, model_documents(document_id)')
      .eq('is_standard', true)
      .order('created_at', { ascending: false });

    if (error) {
      showError('Erro ao carregar modelos padrão.');
      console.error('Error fetching standard models:', error);
    } else {
      const modelsWithDocs = data.map((model: any) => ({
        ...model,
        documents: model.model_documents.map((md: any) => ({ id: md.document_id })),
      }));
      setModels(modelsWithDocs as LanguageModel[]);
    }
    setLoading(false);
  }, []);

  const fetchAvailableDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, file_name, file_path')
      .order('file_name', { ascending: true });

    if (error) {
      console.error('Erro ao carregar documentos disponíveis:', error);
    } else {
      setAvailableDocuments(data || []);
    }
  }, []);

  useEffect(() => {
    const checkPermissionsAndFetchData = async () => {
      setCheckingPermissions(true);
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();
      if (!loggedInUser) {
        navigate('/login');
        return;
      }
      setUser(loggedInUser);
      const canAccess = await requireAdmin(loggedInUser.id);
      setIsAdmin(canAccess);

      if (canAccess) {
        fetchModels();
        fetchAvailableDocuments();
      } else {
        showError('Acesso negado. Apenas administradores podem gerenciar modelos padrão.');
        navigate('/dashboard');
      }
      setCheckingPermissions(false);
    };
    checkPermissionsAndFetchData();
  }, [navigate, fetchModels, fetchAvailableDocuments]);

  const resetForm = () => {
    setProvider('Google Gemini');
    setApiKey('');
    setModelName('');
    setModelVariant('');
    setSystemMessage('');
    setDescription('');
    setAvatarUrl('');
    setIsActive(true);
    setSelectedDocumentIds([]);
    setEditMode(false);
    setCurrentModel(null);
  };

  const handleEditClick = (model: LanguageModel) => {
    setEditMode(true);
    setCurrentModel(model);
    setProvider(model.provider);
    setApiKey(''); // API Key is not pre-filled for security
    setModelName(model.model_name || '');
    setModelVariant(model.model_variant || '');
    setSystemMessage(model.system_message || '');
    setDescription(model.description || '');
    setAvatarUrl(model.avatar_url || '');
    setIsActive(model.is_active);
    setSelectedDocumentIds(model.documents?.map(doc => doc.id) || []);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) {
      showError("Nenhum arquivo selecionado.");
      return;
    }
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showError("A imagem é muito grande (máx. 5MB).");
      return;
    }
    const fileExt = file.name.split('.').pop();
    const filePath = `public/${currentModel?.id || 'new'}/${Date.now()}.${fileExt}`; // Path dentro do bucket

    setUploadingAvatar(true);
    try {
      // If editing and there's an old avatar, remove it
      if (editMode && currentModel?.avatar_url) {
        const oldFilePath = currentModel.avatar_url.split('/model_avatars/')[1];
        if (oldFilePath) await supabase.storage.from('model_avatars').remove([oldFilePath]);
      }

      const { error: uploadError } = await supabase.storage.from('model_avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('model_avatars').getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
      showSuccess('Avatar enviado com sucesso!');
    } catch (error: any) {
      showError(`Erro no upload do avatar: ${error.message}`);
      console.error('Erro de upload:', error);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!avatarUrl || !currentModel) return;

    const filePath = avatarUrl.split('/model_avatars/')[1];
    if (!filePath) {
      showError('Não foi possível identificar o arquivo a ser deletado.');
      return;
    }

    try {
      const { error: removeError } = await supabase.storage.from('model_avatars').remove([filePath]);
      if (removeError) throw removeError;

      const { error: updateError } = await supabase.from('language_models').update({ avatar_url: null }).eq('id', currentModel.id);
      if (updateError) throw updateError;

      setAvatarUrl('');
      showSuccess('Avatar removido.');
    } catch (error: any) {
      showError(`Erro ao remover avatar: ${error.message}`);
      console.error('Erro ao remover avatar:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) {
      showError('Acesso negado.');
      return;
    }
    if (!provider || !apiKey || !modelName || !modelVariant || !systemMessage) {
      showError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    try {
      const modelData = {
        user_id: null, // Standard models are not linked to a specific user
        provider,
        api_key: apiKey,
        model_name: modelName,
        model_variant: modelVariant,
        is_active: isActive,
        is_standard: true,
        system_message: systemMessage,
        description,
        avatar_url: avatarUrl || null,
      };

      let error = null;
      let newModelId = currentModel?.id;

      if (editMode && currentModel) {
        const { error: updateError } = await supabase
          .from('language_models')
          .update(modelData)
          .eq('id', currentModel.id);
        error = updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('language_models')
          .insert(modelData)
          .select('id')
          .single();
        error = insertError;
        if (data) newModelId = data.id;
      }

      if (error) throw error;

      // Update model_documents
      if (newModelId) {
        // Delete existing associations
        await supabase.from('model_documents').delete().eq('model_id', newModelId);
        // Insert new associations
        if (selectedDocumentIds.length > 0) {
          const documentAssociations = selectedDocumentIds.map(docId => ({
            model_id: newModelId,
            document_id: docId,
          }));
          const { error: docError } = await supabase.from('model_documents').insert(documentAssociations);
          if (docError) console.error('Erro ao associar documentos:', docError);
        }
      }

      showSuccess(`Modelo ${editMode ? 'atualizado' : 'adicionado'} com sucesso!`);
      resetForm();
      fetchModels();
    } catch (error: any) {
      showError(`Erro ao ${editMode ? 'atualizar' : 'adicionar'} modelo: ${error.message}`);
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (modelId: string) => {
    if (!window.confirm('Tem certeza que deseja deletar este modelo de IA padrão? Esta ação é irreversível.')) return;
    setLoading(true);
    try {
      // Delete associated documents first (if RLS allows cascade, this might not be strictly necessary, but good practice)
      await supabase.from('model_documents').delete().eq('model_id', modelId);

      const { error } = await supabase.from('language_models').delete().eq('id', modelId);
      if (error) throw error;

      showSuccess('Modelo deletado com sucesso!');
      fetchModels();
    } catch (error: any) {
      showError(`Erro ao deletar modelo: ${error.message}`);
      console.error('Delete error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (modelId: string) => {
    setTestingModelId(modelId);
    try {
      const { data, error } = await supabase.functions.invoke('test-llm-key', {
        body: { modelId },
      });

      if (error) throw new Error(error.message);

      if (data.success) {
        showSuccess(data.message);
      } else {
        showError(data.message || 'Ocorreu um erro desconhecido.');
      }
    } catch (err: any) {
      showError(`Falha ao testar a conexão: ${err.message}`);
    } finally {
      setTestingModelId(null);
    }
  };

  if (checkingPermissions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Should be redirected by useEffect
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '..';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-8 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>{editMode ? 'Editar Modelo Padrão de IA' : 'Adicionar Novo Modelo Padrão de IA'}</CardTitle>
          <CardDescription>
            Gerencie os modelos de IA que serão oferecidos como "agentes professores" para usuários PRO.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24 border-2 border-gray-200">
                <AvatarImage src={avatarUrl || ''} alt={modelName || 'Agente'} />
                <AvatarFallback><Bot className="h-10 w-10" /></AvatarFallback>
              </Avatar>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={avatarInputRef}
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
                  {uploadingAvatar ? "Enviando..." : "Alterar Avatar"}
                </Button>
                {avatarUrl && (
                  <Button type="button" variant="destructive" onClick={handleDeleteAvatar} disabled={uploadingAvatar}>
                    <Trash2 className="h-4 w-4 mr-2" /> Remover Avatar
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model-name">Nome do Agente (Ex: Professor de Matemática)</Label>
                <Input id="model-name" value={modelName} onChange={(e) => setModelName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider">Provedor</Label>
                <Select value={provider} onValueChange={setProvider} disabled>
                  <SelectTrigger id="provider"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Google Gemini">Google Gemini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="model-variant">Modelo Específico</Label>
                <Select value={modelVariant} onValueChange={setModelVariant} disabled={!provider} required>
                  <SelectTrigger id="model-variant"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {provider && MODEL_VARIANTS[provider]?.map((variant) => (
                      <SelectItem key={variant} value={variant}>{variant}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-key">Chave de API (Será usada como padrão)</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={editMode ? "Deixe em branco para não alterar" : "Insira a chave de API"}
                  required={!editMode}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Descrição Curta do Agente</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Uma breve descrição do que este agente faz." />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="system-message">Mensagem do Sistema (Personalidade do Agente)</Label>
                <Textarea id="system-message" value={systemMessage} onChange={(e) => setSystemMessage(e.target.value)} rows={6} placeholder="Ex: Você é um professor de matemática do ENEM, muito didático e paciente..." required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="documents">Documentos de Base (Conhecimento do Agente)</Label>
                <MultiSelect
                  options={availableDocuments.map(doc => ({ label: doc.file_name, value: doc.id }))}
                  selected={selectedDocumentIds}
                  onSelectChange={setSelectedDocumentIds}
                  placeholder="Selecione documentos para o agente"
                />
              </div>
              <div className="flex items-center space-x-2 md:col-span-2">
                <Switch id="is-active" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="is-active">Agente Ativo (Disponível para usuários PRO)</Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting || uploadingAvatar}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editMode ? 'Salvar Alterações' : 'Adicionar Agente'}
              </Button>
              {editMode && (
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting || uploadingAvatar}>
                  Cancelar Edição
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agentes Professores Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : models.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum agente professor configurado ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {models.map((model) => (
                <div key={model.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg shadow-sm">
                  <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <Avatar className="h-12 w-12 border">
                      <AvatarImage src={model.avatar_url || ''} alt={model.model_name || 'Agente'} />
                      <AvatarFallback><Bot className="h-6 w-6" /></AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-medium text-lg">{model.model_name}</h4>
                      <p className="text-sm text-muted-foreground">{model.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {model.provider} - {model.model_variant}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Status: {model.is_active ? 'Ativo' : 'Inativo'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(model.id)}
                      disabled={testingModelId === model.id}
                    >
                      {testingModelId === model.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                      Testar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/ai-chat/${model.id}`)}
                    >
                      <MessageSquareText className="h-4 w-4 mr-2" />
                      Conversar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditClick(model)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(model.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStandardModels;