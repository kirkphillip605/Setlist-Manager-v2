import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, UserX, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const ReactivateAccount = () => {
  const { session, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<"confirm" | "verify">("confirm");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
      if (!session?.user?.email) return;
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
          email: session.user.email,
          options: { shouldCreateUser: false }
      });
      
      if (error) {
          toast.error("Error sending code: " + error.message);
      } else {
          toast.success("Verification code sent to " + session.user.email);
          setStep("verify");
      }
      setLoading(false);
  };

  const handleVerify = async () => {
      if (!session?.user?.email) return;
      setLoading(true);
      
      const { error } = await supabase.auth.verifyOtp({
          email: session.user.email,
          token: otpCode,
          type: 'email'
      });

      if (error) {
          toast.error("Invalid code");
          setLoading(false);
          return;
      }

      // Re-activate profile
      const { error: updateError } = await supabase
          .from('profiles')
          .update({ is_active: true })
          .eq('id', session.user.id);

      if (updateError) {
          toast.error("Failed to reactivate profile");
      } else {
          toast.success("Account reactivated! Welcome back.");
          await refreshProfile();
          navigate("/");
      }
      setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="mx-auto bg-muted p-4 rounded-full mb-4">
                 <UserX className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle>Account Inactive</CardTitle>
            <CardDescription>
                This account was previously deleted or deactivated. To restore access, please verify your identity.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            {step === "confirm" ? (
                <div className="space-y-4">
                    <Button className="w-full" onClick={handleSendCode} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reactivate My Account
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={signOut}>
                        <LogOut className="mr-2 h-4 w-4" /> Cancel & Sign Out
                    </Button>
                </div>
            ) : (
                <div className="space-y-4 flex flex-col items-center">
                    <p className="text-sm text-muted-foreground">Enter the code sent to your email.</p>
                    <InputOTP 
                        maxLength={6} 
                        value={otpCode}
                        onChange={setOtpCode}
                        disabled={loading}
                    >
                        <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                        </InputOTPGroup>
                        <div className="w-4" />
                        <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                        </InputOTPGroup>
                    </InputOTP>
                    
                    <Button className="w-full" onClick={handleVerify} disabled={otpCode.length !== 6 || loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Verify & Restore
                    </Button>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReactivateAccount;