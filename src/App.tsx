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
import ProfileFormAdmin from './pages/ProfileFormAdmin';
import AdminRedefinirSenha from './pages/AdminRedefinirSenha';
import AdminCompanies from './pages/AdminCompanies';
import AdminPermissoes from './pages/AdminPermissoes';
import UserCreate from './pages/UserCreate';
import UpdatePassword from './pages/UpdatePassword';
import NotFound from './pages/NotFound';
import ForumFree from './pages/ForumFree';
import { AdminStandardModels } from './pages/AdminStandardModels'; // Importar a nova página
import StandardModelsList from './pages/StandardModelsList'; // Importar a nova página

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<UpdatePassword />} />
        
        <Route path="/dashboard" element={
          <MainLayout title="Dashboard">
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/perfil" element={
          <MainLayout title="Meu Perfil">
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/noticias" element={
          <MainLayout title="Notícias e Vídeos">
            <ProtectedRoute>
              <News />
            </ProtectedRoute>
          </MainLayout>
        } />


        {/* <Route path="/from_create_user" element={<From_create_user />} /> */} {/* Removido */}
        <Route path="/forum" element={
          <MainLayout title="Fórum" useContainer={false}>
            <ProtectedRoute>
              <Forum />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/forum/:topicId" element={
          <MainLayout title="Fórum" useContainer={false}>
            <ProtectedRoute>
              <Forum />
            </ProtectedRoute>
          </MainLayout>
        } />
           <Route path="/forumfree" element={
          <MainLayout title="Fórum" useContainer={false}>
            <ProtectedRoute>
              <ForumFree />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/forumfree/:topicId" element={
          <MainLayout title="Fórum" useContainer={false}>
            <ProtectedRoute>
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
        <Route path="/language-models" element={
          <MainLayout title="Meus Modelos de IA">
            <ProtectedRoute requiredPermission="Pro">
              <LanguageModels />
            </ProtectedRoute>
          </MainLayout>
        } />
        {/* Nova rota para o chat com IA */}
        <Route path="/ai-chat/:modelId" element={
          <MainLayout title="Chat com IA" useContainer={false}>
            <ProtectedRoute requiredPermission="Pro">
              <AIChatWrapper /> {/* Usar o wrapper aqui */}
            </ProtectedRoute>
          </MainLayout>
        } />
        {/* Rota com conversationId */}
        <Route path="/ai-chat/:modelId/:conversationId" element={ 
          <MainLayout title="Chat com IA" useContainer={false}>
            <ProtectedRoute requiredPermission="Pro">
              <AIChatWrapper /> {/* Usar o wrapper aqui */}
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
        <Route path="/admin/profiles" element={
          <MainLayout title="Admin - Perfis">
            <ProtectedRoute requiredPermission="Admin">
              <Profile />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/admin/profiles/:id" element={
          <MainLayout title="Admin - Editar Perfil">
            <ProtectedRoute requiredPermission="Admin">
              <Profile />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/admin/ProfileFormAdmin" element={
          <MainLayout title="Admin - Perfis">
            <ProtectedRoute requiredPermission="Admin">
              <ProfileFormAdmin />
            </ProtectedRoute>
          </MainLayout>
        } />
        <Route path="/admin/ProfileFormAdmin/:id" element={
          <MainLayout title="Admin - Editar Perfil">
            <ProtectedRoute requiredPermission="Admin">
              <ProfileFormAdmin />
            </ProtectedRoute>
          </MainLayout>
        } />
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

        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;