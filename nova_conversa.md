# INSTRUÇÕES PARA NOVA CONVERSA - JOTA ENEM

## 📋 CONTEXTO ATUAL DA APLICAÇÃO

### 🎯 PROJETO: JOTA ENEM
Plataforma completa de preparação para o ENEM com sistema de permissões hierárquico.

### ✅ FUNCIONALIDADES IMPLEMENTADAS

#### 🔐 AUTENTICAÇÃO
- Sistema completo de login/cadastro com Supabase
- Página de recuperação de senha (/update-password)
- Verificação de email já cadastrado
- Toast em português para feedback do usuário

#### 👥 SISTEMA DE PERMISSÕES
- **Free**: Acesso básico (Notícias, Fórum, Chat, Perfil)
- **Pro**: + Documentos, Modelos de IA, Simulados, Questões, Desempenho
- **Admin**: + Gerenciamento de usuários, notícias, perfis, empresas
- **Dev**: + Gerenciamento de permissões do sistema

#### 📊 DASHBOARD
- Cards dinâmicos baseados nas permissões do usuário
- Navegação visual com ícones e cores por categoria
- Redirecionamento automático baseado em permissões

#### 🗂️ PÁGINAS PRINCIPAIS
- `/` - Home pública
- `/login` - Autenticação
- `/dashboard` - Painel principal
- `/perfil` - Gerenciamento de perfil
- `/noticias` - Conteúdo do ENEM
- `/forum` - Sistema de tópicos e comentários
- `/chat` - Chat em tempo real com presença
- `/documentos` - Upload/gestão de arquivos (Pro)
- `/language-models` - API Keys de IA (Pro)
- `/user-create` - Cadastro de usuários (Admin)
- `/admin/news` - Gerenciamento de notícias (Admin)
- `/admin/profiles` - Gerenciamento de perfis (Admin)
- `/admin/companies` - Gerenciamento de empresas (Admin)
- `/admin/permissoes` - Gerenciamento de permissões (Dev)

#### 🎨 UI/UX
- Layout responsivo com shadcn/ui
- Sistema de cores para permissões
- Avatar upload com Supabase Storage
- Componentes modais para criação/edição
- Loading states em todas as operações

### 🛠️ STACK TÉCNICA

#### 📦 DEPENDÊNCIAS PRINCIPAIS
```json
{
  "react": "^18.3.1",
  "typescript": "^5.5.3",
  "supabase": "^2.57.4",
  "shadcn/ui": "todos componentes instalados",
  "lucide-react": "^0.462.0",
  "react-router-dom": "^6.26.2"
}
```

#### 🎯 CONFIGURAÇÕES
- **Supabase URL**: https://yveobskzyejuaixqsgid.supabase.co
- **Supabase Key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2ZW9ic2t6eWVqdWFpeHFzZ2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4NTEwNDUsImV4cCI6MjA3MzQyNzA0NX0.nsK3IYWDF_SEKHArP34wLgxtGBTBnBnOAyqsb-EX9ic
- **Tailwind**: Configurado com tema shadcn
- **Alias**: `@/` para `src/`

### 📁 ESTRUTURA DE ARQUIVOS
```
src/
├── components/
│   ├── ui/              # Todos componentes shadcn
│   ├── MainLayout.tsx   # Layout principal
│   ├── ProtectedRoute.tsx # Controle de acesso
│   ├── UserNav.tsx      # Navegação do usuário
│   ├── NewsCard.tsx     # Card de notícias
│   ├── CreateTopicDialog.tsx
│   ├── EditTopicDialog.tsx
│   └── EditModelDialog.tsx
├── pages/
│   ├── Home.tsx         # Página inicial
│   ├── Login.tsx        # Autenticação
│   ├── Dashboard.tsx    # Painel principal
│   ├── Profile.tsx      # Perfil do usuário
│   ├── News.tsx         # Notícias e vídeos
│   ├── Forum.tsx        # Sistema de fórum
│   ├── Chat.tsx         # Chat em tempo real
│   ├── Documents.tsx    # Upload documentos (Pro)
│   ├── LanguageModels.tsx # API Keys IA (Pro)
│   ├── UserCreate.tsx   # Cadastro usuários (Admin)
│   ├── AdminNews.tsx    # Gerenciar notícias (Admin)
│   ├── AdminProfiles.tsx # Gerenciar perfis (Admin)
│   ├── AdminCompanies.tsx # Gerenciar empresas (Admin)
│   ├── AdminPermissoes.tsx # Gerenciar permissões (Dev)
│   └── UpdatePassword.tsx # Redefinir senha
├── utils/
│   ├── toast.ts         # Sistema de notificações
│   ├── permissionCheck.ts # Verificação de permissões
│   ├── permissionStyles.ts # Estilos visuais das permissões
│   └── permissions.ts   # Utilitários de permissões
├── integrations/
│   └── supabase/
│       └── client.ts    # Cliente Supabase configurado
└── globals.css          # Estilos globais
```

### 🗃️ BANCO DE DADOS SUPABASE

#### 📊 TABELAS EXISTENTES
- `cliente` - Perfis de usuários com permissões
- `permissoes` - Níveis de permissão (Free, Pro, Admin, Dev)
- `news_items` - Conteúdo de notícias e vídeos
- `forum_topics` - Tópicos do fórum
- `forum_comments` - Comentários do fórum
- `messages` - Mensagens do chat
- `documents` - Upload de documentos (Pro)
- `language_models` - API Keys de IA (Pro)
- `empresa` - Dados de empresas (Admin)

#### 🔐 RLS (ROW LEVEL SECURITY)
Todas as tabelas possuem políticas de segurança implementadas:
- Usuários só acessam seus próprios dados
- Políticas específicas por operação (SELECT, INSERT, UPDATE, DELETE)
- Permissões públicas apenas onde necessário

### 🚀 PRÓXIMOS PASSOS SUGERIDOS

#### 🎯 PRIORIDADE ALTA
1. **Implementar upload de documentos** na página `/documentos`
2. **Criar testes para modelos de IA** na página `/language-models`
3. **Finalizar páginas Admin** (News, Profiles, Companies, Permissões)

#### 🎯 PRIORIDADE MÉDIA
4. **Criar páginas de Simulados e Questões**
5. **Implementar sistema de Desempenho**
6. **Melhorar sistema de presença no Chat**

#### 🎯 PRIORIDADE BAIXA
7. **Adicionar notificações em tempo real**
8. **Implementar sistema de conquistas**
9. **Criar relatórios de progresso**

### ⚠️ INSTRUÇÕES PARA CONTINUAR

**SEMPRE QUE INICIAR UMA NOVA CONVERSA, EXECUTE:**

1. Ler este arquivo `nova_conversa.md` completamente
2. Manter a consistência do código existente
3. Seguir os padrões de nomenclatura e estrutura
4. Implementar RLS em qualquer nova tabela
5. Usar sistema de permissões existente
6. Manter toast em português
7. Preservar a responsividade

**COMANDOS DISPONÍVEIS:**
- `<dyad-command type="rebuild">` - Reconstruir aplicação
- `<dyad-command type="restart">` - Reiniciar servidor
- `<dyad-command type="refresh">` - Atualizar preview

**INICIAR DESENVOLVIMENTO:**
Basta me dizer qual funcionalidade implementar e eu continuarei exatamente de onde paramos! 🚀

---
*Última atualização: Sistema completo de autenticação e permissões funcionando*