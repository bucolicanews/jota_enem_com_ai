import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, PlusCircle, Trash2, TestTube, MessageSquareText, Pencil, ShieldAlert, XCircle } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { EditModelDialog } from '@/components/EditModelDialog';
import { requireAdmin } from '@/utils/permissions';

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

const MODEL_VARIANTS: Record<string, string[]> = {
  'Google Gemini': ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-1.0-pro'],
  // Adicione outros provedores e seus modelos aqui, se necessário
};

export const AdminStandardModels = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [models, setModels] = useState<LanguageModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);

  // Estados do formulário para adicionar/editar
  const [provider, setProvider] = useState('Google Gemini');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelVariant, setModelVariant] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [systemMessage, setSystemMessage] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para o diálogo de edição
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedModelToEdit, setSelectedModelToEdit] = useState<LanguageModel | null>(null);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '..';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const fetchModels = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('language_models')
      .select('*')
      .eq('is_standard', true) // Apenas modelos padrão
      .order('created_at', { ascending: false });

    if (error) {
      showError('Erro ao carregar agentes professores.');
      console.error('Error fetching standard models:', error);
    } else {
      setModels(data as LanguageModel[]);
    }
    setLoading(false);
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
      }
      setCheckingPermissions(false);
    };
    checkPermissionsAndFetchData();
  }, [navigate, fetchModels]);

  const resetForm = () => {
    setProvider('Google Gemini');
    setApiKey('');
    setModelName('');
    setModelVariant('');
    setIsActive(true);
    setSystemMessage('');
    setDescription('');
    setAvatarUrl('');
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
    const filePath = `model_avatars/${Date.now()}.${fileExt}`;

    setUploading(true);
    try {
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
        throw removeError;
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
    if (!provider || !apiKey || !modelName || !modelVariant || !systemMessage || !description) {
      showError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    setIsSubmitting(true);

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

    const { error } = await supabase.from('language_models').insert(modelData);

    if (error) {
      showError(`Erro ao adicionar modelo: ${error.message}`);
      console.error('Submit error:', error);
    } else {
      showSuccess('Agente professor adicionado com sucesso!');
      resetForm();
      fetchModels();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (modelId: string, modelAvatarUrl: string | null) => {
    if (!isAdmin) {
      showError('Acesso negado.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja deletar este agente professor?')) return;

    setIsSubmitting(true);
    try {
      // 1. Deletar avatar do storage, se existir
      if (modelAvatarUrl) {
        const filePath = modelAvatarUrl.split('/model_avatars/')[1];
        if (filePath) {
          const { error: removeError } = await supabase.storage.from('model_avatars').remove([filePath]);
          if (removeError) {
            console.error('Erro ao deletar avatar do storage:', removeError);
            // Não lançar erro aqui, apenas logar, para que a exclusão do DB possa continuar
          }
        }
      }

      // 2. Deletar o modelo do banco de dados
      const { error } = await supabase.from('language_models').delete().eq('id', modelId);
      if (error) {
        throw error;
      }
      showSuccess('Agente professor deletado com sucesso!');
      fetchModels();
    } catch (error: any) {
      showError(`Erro ao deletar agente professor: ${error.message}`);
      console.error('Delete error:', error);
    } finally {
      setIsSubmitting(false);
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

  const handleChat = (modelId: string) => {
    navigate(`/ai-chat/${modelId}`);
  };

  const handleEditClick = (model: LanguageModel) => {
    setSelectedModelToEdit(model);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    fetchModels();
  };

  if (checkingPermissions) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive"><ShieldAlert className="h-12 w-12 mx-auto mb-4" />Acesso Negado</CardTitle>
            <CardDescription className="text-center">Apenas administradores podem acessar esta página.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/dashboard')}>Voltar para o Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Novo Agente Professor</CardTitle>
          <CardDescription>Configure um novo modelo de IA para ser um agente professor padrão.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Avatar do Agente - MOVIDO PARA O TOPO */}
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
                <Label htmlFor="provider">Provedor</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger id="provider">
                    <SelectValue placeholder="Selecione o provedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Google Gemini">Google Gemini</SelectItem>
                    {/* Adicione outros provedores aqui, se necessário */}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model-variant">Modelo Específico</Label>
                <Select value={modelVariant} onValueChange={setModelVariant} disabled={!provider}>
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">Chave de API</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Insira a chave de API"
                  required
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
                />
              </div>

              <div className="flex items-center space-x-2 md:col-span-2">
                <Switch
                  id="is-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="is-active">Ativo (Visível para usuários PRO)</Label>
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Agente
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agentes Professores Ativos</CardTitle>
          <CardDescription>Gerencie os modelos de IA padrão disponíveis para os usuários PRO.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : models.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8">
              <XCircle className="h-12 w-12 mb-4 text-gray-400" />
              <p>Nenhum agente professor padrão configurado ainda.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {models.map((model) => (
                <div key={model.id} className="flex flex-col sm:flex-row items-center justify-between p-4 border rounded-lg shadow-sm">
                  <div className="flex items-center gap-4 mb-4 sm:mb-0 sm:w-1/2">
                    <Avatar className="h-12 w-12 border-2">
                      <AvatarImage src={model.avatar_url || ''} alt={model.model_name || 'Agente'} />
                      <AvatarFallback>{getInitials(model.model_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-medium">{model.model_name} ({model.provider})</h4>
                      <p className="text-sm text-muted-foreground">{model.description}</p>
                      <p className="text-xs text-muted-foreground">Modelo: {model.model_variant}</p>
                      <p className={`text-xs font-semibold ${model.is_active ? 'text-green-600' : 'text-red-600'}`}>
                        Status: {model.is_active ? 'Ativo' : 'Inativo'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center sm:justify-end gap-2 sm:w-1/2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(model.id)}
                      disabled={testingModelId === model.id || isSubmitting}
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
                      onClick={() => handleChat(model.id)}
                      disabled={isSubmitting}
                    >
                      <MessageSquareText className="h-4 w-4 mr-2" />
                      Conversar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditClick(model)}
                      disabled={isSubmitting}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(model.id, model.avatar_url)}
                      disabled={isSubmitting}
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

      {/* Diálogo de Edição */}
      <EditModelDialog
        model={selectedModelToEdit}
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default AdminStandardModels;