import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { MainLayout } from '@/components/MainLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Documents from './pages/Documents';
import LanguageModels from './pages/LanguageModels';
import AIChat from './pages/AIChat'; // Importe a nova página de chat
import AIChatWrapper from './components/AIChatWrapper'; // Importar o wrapper
import Chat from './pages/Chat';
import Forum from './pages/Forum';
import News from './pages/News';
import AdminNews from './pages/AdminNews';
import AdminNewsAdmin from './pages/AdminNewsAdmin';
import ProfileFormAdmin from './pages/ProfileFormAdmin11111';
import AdminRedefinirSenha from './pages/AdminRedefinirSenha';
import AdminCompanies from './pages/AdminCompanies';
import AdminPermissoes from './pages/AdminPermissoes';
import UserCreate from './pages/UserCreate';
import UpdatePassword from './pages/UpdatePassword';
import NotFound from './pages/NotFound';
import ForumFree from './pages/ForumFree';
import { AdminStandardModels } from './pages/AdminStandardModels'; // Importar a nova página
import StandardModelsList from './pages/StandardModelsList'; // Importar a nova página
import AdminQuestions from './pages/AdminQuestions'; // Importar a nova página de administração de questões
import QuestionBank from './pages/QuestionBank'; // Importar a nova página de banco de questões
import TakeTest from './pages/TakeTest'; // Importar a nova página de realização de prova
import UserTests from './pages/UserTests'; // Importar a nova página de lista de provas do usuário
import Pricing from './pages/Pricing'; // Importar a nova página de planos
import AdminPlans from './pages/AdminPlans'; // Importar a nova página de administração de planos

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<UpdatePassword />} />
        <Route path="/pricing" element={<Pricing />} /> {/* Nova rota para a página de planos */}
        
        <Route path="/dashboard" element={
          <MainLayout title="Dashboard">
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          </MainLayout>
        } />
        {/* Rota para o perfil do próprio usuário (todos os níveis de permissão) */}
        <Route path="/perfil" element={
          <MainLayout title="Meu Perfil">
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/noticias" element={
          <MainLayout title="Notícias e Vídeos" useContainer={false}>
            <ProtectedRoute>
              <News />
            </ProtectedRoute>
          </MainLayout>
        } />

        {/* Rota para o Fórum PRO (acesso para PRO e superiores) */}
        <Route path="/forum" element={
          <MainLayout title="Fórum" useContainer={false}>
            <ProtectedRoute requiredPermission="Pro">
              <Forum />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/forum/:topicId" element={
          <MainLayout title="Fórum" useContainer={false}>
            <ProtectedRoute requiredPermission="Pro">
              <Forum />
            </ProtectedRoute>
          </MainLayout>
        } />
        
        {/* Rota para o Fórum FREE (acesso para FREE e superiores) */}
        <Route path="/forumfree" element={
          <MainLayout title="Fórum" useContainer={false}>
            <ProtectedRoute> {/* Acesso padrão (Free) */}
              <ForumFree />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/forumfree/:topicId" element={
          <MainLayout title="Fórum" useContainer={false}>
            <ProtectedRoute> {/* Acesso padrão (Free) */}
              <ForumFree />
            </ProtectedRoute>
          </MainLayout>
        } />

        <Route path="/chat" element={
          <MainLayout title="Chat da Turma" useContainer={false}>
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          </MainLayout>
        } />

        <Route path="/documentos" element={
          <MainLayout title="Meus Documentos">
            <ProtectedRoute requiredPermission="Pro">
              <Documents />
            </ProtectedRoute>
          </MainLayout>
        } />
        
        {/* Rota para Minhas Chaves de IA (acesso para TODOS) */}
        <Route path="/language-models" element={
          <MainLayout title="Minhas Chaves de IA">
            <ProtectedRoute> {/* Acesso padrão (Free) */}
              <LanguageModels />
            </ProtectedRoute>
          </MainLayout>
        } />
        
        {/* Nova rota para o chat com IA (AGORA ACESSÍVEL A TODOS) */}
        <Route path="/ai-chat/:modelId" element={
          <MainLayout title="Chat com IA" useContainer={false}>
            <ProtectedRoute> {/* Acesso padrão (Free) */}
              <AIChatWrapper />
            </ProtectedRoute>
          </MainLayout>
        } />
        {/* Rota com conversationId (AGORA ACESSÍVEL A TODOS) */}
        <Route path="/ai-chat/:modelId/:conversationId" element={ 
          <MainLayout title="Chat com IA" useContainer={false}>
            <ProtectedRoute> {/* Acesso padrão (Free) */}
              <AIChatWrapper />
            </ProtectedRoute>
          </MainLayout>
        } />
        {/* Nova rota para listar agentes professores padrão */}
        <Route path="/standard-models" element={
          <MainLayout title="Agentes Professores">
            <ProtectedRoute requiredPermission="Pro">
              <StandardModelsList />
            </ProtectedRoute>
          </MainLayout>
        } />
        
        {/* Rotas para o Banco de Questões */}
        <Route path="/question-bank" element={
          <MainLayout title="Banco de Questões">
            <ProtectedRoute> {/* Acesso para todos, funcionalidades variam por permissão */}
              <QuestionBank />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/take-test/:testId" element={
          <MainLayout title="Realizar Prova">
            <ProtectedRoute> {/* Acesso para todos que geraram a prova */}
              <TakeTest />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/user-tests" element={
          <MainLayout title="Minhas Provas">
            <ProtectedRoute> {/* Acesso para todos que geraram provas */}
              <UserTests />
            </ProtectedRoute>
          </MainLayout>
        } />

        <Route path="/user-create" element={
          <MainLayout title="Cadastrar Usuário">
            <ProtectedRoute requiredPermission="Admin">
              <UserCreate />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/admin/news" element={
          <MainLayout title="Admin - Notícias">
            <ProtectedRoute requiredPermission="Prof">
              <AdminNews />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/admin/newsAdmin" element={
          <MainLayout title="Admin - Notícias">
            <ProtectedRoute requiredPermission="Admin">
              <AdminNewsAdmin />
            </ProtectedRoute>
          </MainLayout>
        } />
        {/* Rota para administradores editarem perfis de outros usuários */}
        <Route path="/admin/profiles/:id" element={
          <MainLayout title="Admin - Editar Perfil">
            <ProtectedRoute requiredPermission="Admin">
              <ProfileFormAdmin />
            </ProtectedRoute>
          </MainLayout>
        } />
        {/* Removida a rota /admin/ProfileFormAdmin e /admin/ProfileFormAdmin/:id, pois /admin/profiles/:id agora usa ProfileFormAdmin.tsx */}
          <Route path="/admin/redefinir-senha" element={
          <MainLayout title="Admin - Redefinir Senha">
            <ProtectedRoute requiredPermission="Admin">
              <AdminRedefinirSenha />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/admin/redefinir-senha/:id" element={
          <MainLayout title="Admin - Editar Senha">
            <ProtectedRoute requiredPermission="Admin">
              <AdminRedefinirSenha />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/admin/companies" element={
          <MainLayout title="Admin - Empresas">
            <ProtectedRoute requiredPermission="Admin">
              <AdminCompanies />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/admin/permissoes" element={
          <MainLayout title="Admin - Permissões">
            <ProtectedRoute requiredPermission="Admin">
              <AdminPermissoes />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/admin/standard-models" element={
          <MainLayout title="Admin - Agentes Padrão">
            <ProtectedRoute requiredPermission="Admin">
              <AdminStandardModels />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/admin/questions" element={
          <MainLayout title="Admin - Questões">
            <ProtectedRoute requiredPermission="Prof"> {/* Acesso para Prof e Admin */}
              <AdminQuestions />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/admin/plans" element={ {/* Nova rota para AdminPlans */}
          <MainLayout title="Admin - Planos">
            <ProtectedRoute requiredPermission="Admin">
              <AdminPlans />
            </ProtectedRoute>
          </MainLayout>
        } />

        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;