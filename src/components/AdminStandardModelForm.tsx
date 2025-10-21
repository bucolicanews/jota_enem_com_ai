// src/components/AdminStandardModelForm.tsx

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, CheckCircle } from 'lucide-react'; // Importar o ícone de CheckCircle

// Esquema de validação com lógica condicional
const formSchema = z.object({
  provider: z.string().min(1, 'Provedor é obrigatório.'),
  model_name: z.string().min(1, 'Nome do Agente é obrigatório.'),
  model_variant: z.string().min(1, 'Modelo (variante) é obrigatório.'),
  description: z.string().optional(),
  system_message: z.string().optional(),
  api_key: z.string().optional(),
  is_active: z.boolean().default(true),
  avatar_url: z.string().url().optional().or(z.literal('')),
}).refine(data => {
  if (data.provider !== 'Google Vertex AI') {
    return data.api_key && data.api_key.length > 0;
  }
  return true;
}, {
  message: 'A Chave de API é obrigatória para este provedor.',
  path: ['api_key'],
});

type AdminModelFormValues = z.infer<typeof formSchema>;

interface AdminStandardModelFormProps {
  isAdmin: boolean;
  onSubmit: (data: AdminModelFormValues) => Promise<void>;
  isSubmitting: boolean;
  initialModel: any | null;
}

const MODEL_VARIANTS: Record<string, string[]> = {
  'Google Vertex AI': ['gemini-1.5-pro-preview-0409', 'gemini-1.0-pro', 'gemini-1.5-flash-preview-0514'],
  'Google Gemini': ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest'],
  'OpenAI': ['gpt-3.5-turbo', 'gpt-4o', 'gpt-4-turbo'],
};

export const AdminStandardModelForm = ({ isAdmin, onSubmit, isSubmitting, initialModel }: AdminStandardModelFormProps) => {
  const form = useForm<AdminModelFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialModel || {
      provider: 'Google Vertex AI',
      model_name: '',
      model_variant: 'gemini-1.5-pro-preview-0409',
      description: '',
      system_message: '',
      api_key: '',
      is_active: true,
      avatar_url: '',
    },
  });

  const provider = form.watch('provider');

  useEffect(() => {
      if (provider && MODEL_VARIANTS[provider]) {
        form.setValue('model_variant', MODEL_VARIANTS[provider][0]);
      }
    }, [provider, form]);

  useEffect(() => {
      if (initialModel) {
        form.reset(initialModel);
      }
    }, [initialModel, form]);

  return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provedor</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione o provedor" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                                <SelectItem value="Google Vertex AI">Google Vertex AI (Recomendado)</SelectItem>
                                <SelectItem value="Google Gemini">Google Gemini (API Key Simples)</SelectItem>
                                <SelectItem value="OpenAI">OpenAI</SelectItem>
                              </SelectContent>
                            </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="model_variant"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo Específico</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                                {MODEL_VARIANTS[provider]?.map(variant => (
                                  <SelectItem key={variant} value={variant}>{variant}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField control={form.control} name="model_name" render={({ field }) => (<FormItem><FormLabel>Nome do Agente</FormLabel><FormControl><Input placeholder="Ex: Professor de Matemática" {...field} /></FormControl><FormMessage /></FormItem>)} />

          {provider !== 'Google Vertex AI' && (
            <FormField
              control={form.control}
              name="api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chave de API</FormLabel>
                  <FormControl><Input type="password" placeholder="Cole a chave de API aqui" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* NOVO: INDICAÇÃO VISUAL PARA O VERTEX AI */}
          {provider === 'Google Vertex AI' && (
            <div className="p-3 bg-blue-50 border-l-4 border-blue-400 text-blue-800 rounded-md flex items-center gap-2">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">
                A autenticação será feita de forma segura usando a chave global configurada no Supabase. Nenhum campo de chave é necessário.
              </p>
            </div>
          )}

          <FormField control={form.control} name="system_message" render={({ field }) => (<FormItem><FormLabel>Mensagem de Sistema (Instruções para a IA)</FormLabel><FormControl><Textarea placeholder="Ex: Você é um professor de matemática especializado em ENEM..." className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descrição Curta (para exibição)</FormLabel><FormControl><Textarea placeholder="Ex: Agente especializado em matemática para o ENEM." {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="avatar_url" render={({ field }) => (<FormItem><FormLabel>URL do Avatar</FormLabel><FormControl><Input placeholder="https://exemplo.com/imagem.png" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="is_active" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Ativo (Visível para usuários PRO)</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />

          <Button type="submit" disabled={isSubmitting || !isAdmin}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialModel ? 'Salvar Alterações' : 'Adicionar Agente'}
          </Button>
        </form>
      </Form>
    );
};