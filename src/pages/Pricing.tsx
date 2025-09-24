import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, Crown, DollarSign, Users, MessageSquareText, FileText, Target } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

// Make sure to call loadStripe outside of a component’s render to avoid
// recreating the Stripe object on every render.
const stripePromise = loadStripe(import.meta.env.VITE_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface Plano {
  id: string;
  nome: string;
  id_stripe_product: string | null;
  id_stripe_price_monthly: string | null;
  id_stripe_price_one_time: string | null;
  tipo: 'recorrente' | 'pre_pago';
  preco: number;
  limite_perguntas: number;
  limite_redacoes: number;
  limite_simulados: number;
  limite_usuarios_adicionais: number;
}

const Pricing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null); // Supabase User
  const [userPlanId, setUserPlanId] = useState<string | null>(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('planos')
      .select('*')
      .order('preco', { ascending: true });

    if (error) {
      showError('Erro ao carregar planos.');
      console.error('Error fetching plans:', error);
    } else {
      setPlans(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const getUserAndPlan = async () => {
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();
      setUser(loggedInUser);

      if (loggedInUser) {
        const { data: profile, error: profileError } = await supabase
          .from('cliente')
          .select('plano_id')
          .eq('id', loggedInUser.id)
          .single();

        if (profileError) {
          console.error('Error fetching user profile:', profileError);
        } else if (profile) {
          setUserPlanId(profile.plano_id);
        }
      }
      fetchPlans();
    };
    getUserAndPlan();
  }, [fetchPlans]);

  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    const sessionId = searchParams.get('session_id');

    if (success) {
      showSuccess('Pagamento realizado com sucesso! Seu plano será ativado em breve.');
      // In a real app, you'd verify the session_id with Stripe and update user's plan via webhook
      navigate('/dashboard', { replace: true });
    }

    if (canceled) {
      showError('Pagamento cancelado. Você pode tentar novamente.');
      navigate('/pricing', { replace: true });
    }
  }, [searchParams, navigate]);

  const handleSubscribe = async (plan: Plano) => {
    if (!user) {
      showError('Você precisa estar logado para assinar um plano.');
      navigate('/login');
      return;
    }

    setIsCheckoutLoading(true);
    showSuccess(`Iniciando checkout para o plano ${plan.nome}...`);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          planoId: plan.id,
          returnUrl: window.location.origin + '/pricing', // URL para onde o Stripe redirecionará
        },
      });

      if (error) throw new Error(error.message);

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl; // Redirect to Stripe Checkout
      } else {
        showError('Não foi possível obter a URL de checkout.');
      }
    } catch (err: any) {
      showError(`Erro ao iniciar o checkout: ${err.message}`);
      console.error('Checkout error:', err);
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Escolha o Plano Perfeito para Você</h1>
        <p className="text-lg text-muted-foreground">
          Desbloqueie todo o potencial do JOTA ENEM com nossos planos flexíveis.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = userPlanId === plan.id;
          return (
            <Card key={plan.id} className={`flex flex-col ${isCurrentPlan ? 'border-2 border-primary shadow-lg' : ''}`}>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold">{plan.nome}</CardTitle>
                <CardDescription className="text-lg">
                  R$ {plan.preco.toFixed(2)} {plan.tipo === 'recorrente' ? '/ mês' : ' (pagamento único)'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between space-y-4 p-6">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {plan.limite_perguntas === 0 ? 'Perguntas ilimitadas' : `${plan.limite_perguntas} perguntas de IA`}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {plan.limite_redacoes === 0 ? 'Redações ilimitadas' : `${plan.limite_redacoes} correções de redação`}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {plan.limite_simulados === 0 ? 'Simulados ilimitados' : `${plan.limite_simulados} simulados`}
                  </li>
                  {plan.limite_usuarios_adicionais > 0 && (
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {plan.limite_usuarios_adicionais} usuários adicionais (Plano Professor)
                    </li>
                  )}
                  {/* Adicione mais benefícios aqui */}
                </ul>
                <Button
                  className="w-full mt-6"
                  onClick={() => handleSubscribe(plan)}
                  disabled={isCurrentPlan || isCheckoutLoading}
                >
                  {isCheckoutLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCurrentPlan ? 'Plano Atual' : 'Assinar Agora'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-center text-sm text-muted-foreground mt-8">
        Ao assinar, você concorda com nossos Termos de Serviço e Política de Privacidade.
      </p>
    </div>
  );
};

const PricingWrapper = () => (
  <Elements stripe={stripePromise}>
    <Pricing />
  </Elements>
);

export default PricingWrapper;