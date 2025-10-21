// src/App.tsx

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { MainLayout } from '@/components/MainLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// --- Importação de Páginas ---
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Documents from './pages/Documents';
import LanguageModels from './pages/LanguageModels';
import AIChat from './pages/AIChat';
import Chat from './pages/Chat';
import Forum from './pages/Forum';
import ForumFree from './pages/ForumFree';
import News from './pages/News';
import UpdatePassword from './pages/UpdatePassword';
import NotFound from './pages/NotFound';
import Pricing from './pages/Pricing';

// Páginas de IA
import StandardModelsList from './pages/StandardModelsList';
import AIChatWrapper from './components/AIChatWrapper';

// Páginas de Banco de Questões
import QuestionBank from './pages/QuestionBank';
import TakeTest from './pages/TakeTest';
import UserTests from './pages/UserTests';

// Páginas de Administração
import AdminNews from './pages/AdminNews';
import AdminNewsAdmin from './pages/AdminNewsAdmin';
import ProfileFormAdmin from './pages/ProfileFormAdmin11111';
import AdminRedefinirSenha from './pages/AdminRedefinirSenha';
import AdminCompanies from './pages/AdminCompanies';
import AdminPermissoes from './pages/AdminPermissoes';
import UserCreate from './pages/UserCreate';
import AdminQuestions from './pages/AdminQuestions';
import AdminPlans from './pages/AdminPlans';

// CORREÇÃO PRINCIPAL AQUI: Importando como 'default' (sem chaves)
import AdminStandardModels from './pages/AdminStandardModels';
import AdminStandardModelsDorm from './pages/AdminStandardModelsDorm';


function App() {
  return (
    <Router>
      <Toaster />
      <Routes>
        {/* --- Rotas Públicas --- */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/pricing" element={<Pricing />} />

        {/* --- Rotas Protegidas para Usuários --- */}
        <Route path="/dashboard" element={<MainLayout title="Dashboard"><ProtectedRoute><Dashboard /></ProtectedRoute></MainLayout>} />
        <Route path="/perfil" element={<MainLayout title="Meu Perfil"><ProtectedRoute><Profile /></ProtectedRoute></MainLayout>} />
        <Route path="/noticias" element={<MainLayout title="Notícias e Vídeos" useContainer={false}><ProtectedRoute><News /></ProtectedRoute></MainLayout>} />
        <Route path="/forum" element={<MainLayout title="Fórum" useContainer={false}><ProtectedRoute requiredPermission="Pro"><Forum /></ProtectedRoute></MainLayout>} />
        <Route path="/forum/:topicId" element={<MainLayout title="Fórum" useContainer={false}><ProtectedRoute requiredPermission="Pro"><Forum /></ProtectedRoute></MainLayout>} />
        <Route path="/forumfree" element={<MainLayout title="Fórum" useContainer={false}><ProtectedRoute><ForumFree /></ProtectedRoute></MainLayout>} />
        <Route path="/forumfree/:topicId" element={<MainLayout title="Fórum" useContainer={false}><ProtectedRoute><ForumFree /></ProtectedRoute></MainLayout>} />
        <Route path="/chat" element={<MainLayout title="Chat da Turma" useContainer={false}><ProtectedRoute><Chat /></ProtectedRoute></MainLayout>} />
        <Route path="/documentos" element={<MainLayout title="Meus Documentos"><ProtectedRoute requiredPermission="Pro"><Documents /></ProtectedRoute></MainLayout>} />
        <Route path="/language-models" element={<MainLayout title="Minhas Chaves de IA"><ProtectedRoute><LanguageModels /></ProtectedRoute></MainLayout>} />
        <Route path="/ai-chat/:modelId" element={<MainLayout title="Chat com IA" useContainer={false}><ProtectedRoute><AIChatWrapper /></ProtectedRoute></MainLayout>} />
        <Route path="/ai-chat/:modelId/:conversationId" element={<MainLayout title="Chat com IA" useContainer={false}><ProtectedRoute><AIChatWrapper /></ProtectedRoute></MainLayout>} />

        {/* CORREÇÃO LÓGICA: Esta rota deve mostrar a lista de modelos para usuários, não a página de admin */}
        <Route path="/standard-models" element={<MainLayout title="Agentes Professores"><ProtectedRoute requiredPermission="Pro"><AdminStandardModels /></ProtectedRoute></MainLayout>} />

        <Route path="/question-bank" element={<MainLayout title="Banco de Questões"><ProtectedRoute><QuestionBank /></ProtectedRoute></MainLayout>} />
        <Route path="/take-test/:testId" element={<MainLayout title="Realizar Prova"><ProtectedRoute><TakeTest /></ProtectedRoute></MainLayout>} />
        <Route path="/user-tests" element={<MainLayout title="Minhas Provas"><ProtectedRoute><UserTests /></ProtectedRoute></MainLayout>} />

        {/* --- Rotas de Administração --- */}
        <Route path="/user-create" element={<MainLayout title="Cadastrar Usuário"><ProtectedRoute requiredPermission="Admin"><UserCreate /></ProtectedRoute></MainLayout>} />
        <Route path="/admin/news" element={<MainLayout title="Admin - Notícias"><ProtectedRoute requiredPermission="Prof"><AdminNews /></ProtectedRoute></MainLayout>} />
        <Route path="/admin/newsAdmin" element={<MainLayout title="Admin - Notícias"><ProtectedRoute requiredPermission="Admin"><AdminNewsAdmin /></ProtectedRoute></MainLayout>} />
        <Route path="/admin/profiles/:id" element={<MainLayout title="Admin - Editar Perfil"><ProtectedRoute requiredPermission="Admin"><ProfileFormAdmin /></ProtectedRoute></MainLayout>} />
        <Route path="/admin/redefinir-senha" element={<MainLayout title="Admin - Redefinir Senha"><ProtectedRoute requiredPermission="Admin"><AdminRedefinirSenha /></ProtectedRoute></MainLayout>} />
        <Route path="/admin/redefinir-senha/:id" element={<MainLayout title="Admin - Editar Senha"><ProtectedRoute requiredPermission="Admin"><AdminRedefinirSenha /></ProtectedRoute></MainLayout>} />
        <Route path="/admin/companies" element={<MainLayout title="Admin - Empresas"><ProtectedRoute requiredPermission="Admin"><AdminCompanies /></ProtectedRoute></MainLayout>} />
        <Route path="/admin/permissoes" element={<MainLayout title="Admin - Permissões"><ProtectedRoute requiredPermission="Admin"><AdminPermissoes /></ProtectedRoute></MainLayout>} />
        <Route path="/admin/questions" element={<MainLayout title="Admin - Questões"><ProtectedRoute requiredPermission="Prof"><AdminQuestions /></ProtectedRoute></MainLayout>} />
        <Route path="/admin/plans" element={<MainLayout title="Admin - Planos"><ProtectedRoute requiredPermission="Admin"><AdminPlans /></ProtectedRoute></MainLayout>} />

        {/* Rota correta para a página de administração de modelos */}
        <Route path="/admin/standard-models" element={<MainLayout title="Admin - Agentes Padrão"><ProtectedRoute requiredPermission="Admin"><AdminStandardModels /></ProtectedRoute></MainLayout>} />

        {/* Rota para página não encontrada */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;