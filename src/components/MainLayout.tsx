import { Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { UserNav } from './UserNav';
import { ArrowLeft, Home, User, MessageSquare, BookOpen, Newspaper, Settings, KeyRound } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  showBackButton?: boolean;
  actions?: React.ReactNode;
  useContainer?: boolean;
}

export const MainLayout = ({ children, title, showBackButton = true, actions, useContainer = true }: MainLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-x-hidden">
      {/* Header com logo e navegação */}
      <header className="flex-shrink-0 sticky top-0 z-50 w-full border-b bg-white backdrop-blur supports-[backdrop-filter]:bg-white/95">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Logo JOTA ENEM */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">J</span>
              </div>
              <span className="font-bold text-xl text-gray-800 hidden sm:block">JOTA ENEM</span>
            </div>

            {/* Navegação principal */}
            <nav className="hidden md:flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-2">
                <Home className="h-4 w-4" />
                Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/noticias')} className="gap-2">
                <Newspaper className="h-4 w-4" />
                Notícias
              </Button>
              {/* Removido Fórum e Chat */}
              <Button variant="ghost" size="sm" onClick={() => navigate('/language-models')} className="gap-2">
                <KeyRound className="h-4 w-4" />
                Minhas Chaves de IA
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {/* Botão voltar e título */}
            <div className="flex items-center gap-4">
              {showBackButton && (
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="md:hidden">
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Voltar</span>
                </Button>
              )}
              <h1 className="text-xl font-bold text-gray-800 hidden md:block">{title}</h1>
            </div>

            {/* Ações e usuário */}
            <div className="flex items-center gap-2">
              {actions}
              <UserNav />
            </div>
          </div>
        </div>

        {/* Título para mobile */}
        <div className="container py-2 md:hidden">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className={`flex-1 ${useContainer ? 'overflow-y-auto' : 'overflow-hidden'}`}>
        {useContainer ? (
          <div className="container py-4 sm:py-6 lg:py-8">{children}</div>
        ) : (
          children
        )}
      </main>
    </div>
  );
};