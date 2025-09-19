import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Bot, MessageSquareText } from 'lucide-react';
import { showError } from '@/utils/toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface LanguageModel {
  id: string;
  provider: string;
  model_name: string | null;
  model_variant: string | null;
  is_active: boolean;
  description: string | null;
  avatar_url: string | null;
}

const StandardModelsList = () => {
  const navigate = useNavigate();
  const [models, setModels] = useState<LanguageModel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStandardModels = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('language_models')
      .select('id, provider, model_name, model_variant, is_active, description, avatar_url')
      .eq('is_standard', true)
      .eq('is_active', true) // Apenas modelos padrão ativos
      .order('model_name', { ascending: true });

    if (error) {
      showError('Erro ao carregar agentes professores.');
      console.error('Error fetching standard models:', error);
    } else {
      setModels(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStandardModels();
  }, [fetchStandardModels]);

  const handleChat = (modelId: string) => {
    navigate(`/ai-chat/${modelId}`);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '..';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Agentes Professores de IA</CardTitle>
          <CardDescription>
            Converse com nossos agentes de IA especializados para tirar suas dúvidas e obter ajuda nos estudos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : models.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum agente professor disponível no momento.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {models.map((model) => (
                <Card key={model.id} className="flex flex-col items-center text-center p-4">
                  <Avatar className="h-20 w-20 mb-4 border-2">
                    <AvatarImage src={model.avatar_url || ''} alt={model.model_name || 'Agente'} />
                    <AvatarFallback><Bot className="h-10 w-10" /></AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold text-lg mb-1">{model.model_name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">{model.description}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleChat(model.id)}
                    className="w-full"
                  >
                    <MessageSquareText className="h-4 w-4 mr-2" />
                    Conversar com {model.model_name?.split(' ')[0] || 'Agente'}
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StandardModelsList;