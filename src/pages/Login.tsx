import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/components/theme-provider";

const Login = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Welcome to BandMate</CardTitle>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            appearance={{ 
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(var(--primary))',
                    brandAccent: 'hsl(var(--primary) / 0.8)',
                    inputText: 'hsl(var(--foreground))',
                    inputLabelText: 'hsl(var(--muted-foreground))',
                    inputBorder: 'hsl(var(--border))',
                    inputBackground: 'hsl(var(--background))',
                  },
                },
              },
            }}
            theme={theme === 'dark' ? 'dark' : 'default'}
            providers={[]}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;