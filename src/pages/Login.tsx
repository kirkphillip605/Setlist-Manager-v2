import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { storageAdapter } from "@/lib/storageAdapter";
import { useTheme } from "@/components/theme-provider";
import { LoadingDialog } from "@/components/LoadingDialog";
import { CachedImage } from "@/components/CachedImage";

const Login = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  
  // Auth State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [rememberMe, setRememberMe] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Reset Password State
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);

  // Determine Logo Theme
  useEffect(() => {
    if (theme === 'system') {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        setIsDarkMode(mediaQuery.matches);
        const listener = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
        mediaQuery.addEventListener('change', listener);
        return () => mediaQuery.removeEventListener('change', listener);
    } else {
        setIsDarkMode(theme === 'dark');
    }
  }, [theme]);

  const logoSrc = isDarkMode ? "/setlist-logo-dark.png" : "/setlist-logo-transparent.png";

  // Load Remembered Email
  useEffect(() => {
    const loadSavedEmail = async () => {
        const saved = await storageAdapter.getItem("login_email");
        if (saved) {
            setEmail(saved);
            setRememberMe(true);
        }
    };
    loadSavedEmail();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const getRedirectUrl = () => {
    if (Capacitor.isNativePlatform()) {
        return 'com.kirknetllc.setlistpro://google-auth';
    }
    return `${window.location.origin}/auth/callback`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Save/Clear Remember Me
    if (rememberMe) {
        await storageAdapter.setItem("login_email", email);
    } else {
        await storageAdapter.removeItem("login_email");
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { 
        emailRedirectTo: getRedirectUrl()
      }
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Check your email for confirmation link!");
      navigate("/verify-email");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const redirectUrl = getRedirectUrl();
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: false
      }
    });

    if (error) toast.error(error.message);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/update-password` 
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset link sent to your email!");
      setIsResetOpen(false);
      setResetEmail("");
    }
    setResetLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 overflow-y-auto">
      <LoadingDialog open={loading} message="Authenticating..." />
      <Card className="w-full max-w-md border-border shadow-lg my-auto">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-2 h-16">
             <CachedImage 
                src={logoSrc} 
                alt="Setlist Manager Pro" 
                className="h-16 object-contain" 
                fallbackSrc="/setlist-icon.png"
             />
          </div>
        </CardHeader>
        <CardContent>
            <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 h-9">
                    <TabsTrigger value="login" className="text-xs">Sign In</TabsTrigger>
                    <TabsTrigger value="register" className="text-xs">Create Account</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email-login">Email</Label>
                            <Input 
                                id="email-login" 
                                type="email" 
                                placeholder="band@example.com" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password-login">Password</Label>
                            <Input 
                                id="password-login" 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox id="remember" checked={rememberMe} onCheckedChange={(c) => setRememberMe(!!c)} />
                            <Label htmlFor="remember" className="text-sm font-normal leading-none cursor-pointer">
                                Remember email
                            </Label>
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                            Sign In
                        </Button>

                        <div className="text-center">
                            <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="link" className="px-0 h-auto text-xs font-normal text-muted-foreground">Forgot password?</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Reset Password</DialogTitle>
                                        <DialogDescription>Enter your email address and we'll send you a link to reset your password.</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleForgotPassword} className="space-y-4 py-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="reset-email">Email</Label>
                                            <Input 
                                                id="reset-email" 
                                                type="email" 
                                                value={resetEmail}
                                                onChange={(e) => setResetEmail(e.target.value)}
                                                required
                                                autoComplete="email"
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit" disabled={resetLoading}>
                                                {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Send Reset Link
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </form>
                </TabsContent>

                <TabsContent value="register">
                    <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email-register">Email</Label>
                            <Input 
                                id="email-register" 
                                type="email" 
                                placeholder="band@example.com" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password-register">Password</Label>
                            <Input 
                                id="password-register" 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                            Create Account
                        </Button>
                    </form>
                </TabsContent>
            </Tabs>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button variant="outline" type="button" className="w-full" onClick={handleGoogleLogin}>
            <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
            <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
            </svg>
            Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;