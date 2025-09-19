import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';

const Home = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    getUser();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 text-center">
      <div className="max-w-3xl">
        <h1 className="text-5xl font-extrabold mb-4 text-gray-800">
          Prepare-se para o ENEM com o JOTA ENEM!
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Sua plataforma completa com simulados, questões personalizadas e acompanhamento de desempenho para garantir a sua aprovação.
        </p>
        <div className="space-x-4">
          {!loading && (
            user ? (
              <Link to="/dashboard">
                <Button size="lg">Acessar Painel</Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button size="lg">Entrar</Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline">
                    Cadastre-se
                  </Button>
                </Link>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;