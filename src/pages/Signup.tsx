import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import {
  UserCircle,
  BookOpen,
  Loader2,
  ArrowLeft,
  Mail,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { z } from "zod";
import * as api from "@/services/api";
import type { AppRole } from "@/services/api";
import logo from '@/components/assets/logo.png';
import { db } from '@/config/firebase' 

/* ---------------- Constants ---------------- */

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/* ---------------- Component ---------------- */

export default function Signup() {
  /* Form fields */
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("student");
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
  }>({});

  /* OTP state */
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpExpiry, setOtpExpiry] = useState(0);
  const [countdown, setCountdown] = useState(0);

  /* School Verification Code */
  const [schoolCodeInput, setSchoolCodeInput] = useState("");
  
  /* Submit / done */
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const otpInputRef = useRef<HTMLInputElement>(null);

  /* Clear form on mount */
  useEffect(() => {
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("student");
    setErrors({});
  }, []);

  /* Handle browser back button */
  useEffect(() => {
    const handlePopState = () => navigate("/", { replace: true });
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate]);

  /* OTP expiry countdown */
  useEffect(() => {
    if (!otpSent) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((otpExpiry - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [otpSent, otpExpiry]);

  /* ---------------- Form validation ---------------- */

  const validateFields = () => {
    const newErrors: typeof errors = {};

    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }

    try {
      z.string().email().parse(email);
    } catch {
      newErrors.email = "Please enter a valid email";
    }

    if (!password || password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* ---------------- Send OTP ---------------- */

  const handleSendOtp = async () => {
    if (!validateFields()) return;

    setIsSendingOtp(true);
    const result = await api.sendEmailOTP(email);
    setIsSendingOtp(false);

    if (result.error) {
      toast({
        variant: "destructive",
        title: "Failed to send code",
        description: result.error,
      });
      return;
    }

    setGeneratedOtp(result.otp!);
    setOtpExpiry(Date.now() + OTP_EXPIRY_MS);
    setOtpSent(true);
    setOtpInput("");
    setCountdown(OTP_EXPIRY_MS / 1000);

    setTimeout(() => otpInputRef.current?.focus(), 100);

    toast({
      title: "Verification code sent!",
      description: `A 6-digit code has been sent to ${email}. Check your inbox.`,
    });
  };

  /* ---------------- Sign Up (after OTP verified) ---------------- */

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otpSent) {
      toast({
        variant: "destructive",
        title: "Email not verified",
        description: "Please click 'Send Code' to receive a verification code first.",
      });
      return;
    }

    if (!otpInput || otpInput.length !== 6) {
      toast({
        variant: "destructive",
        title: "Invalid code",
        description: "Please enter the 6-digit verification code.",
      });
      return;
    }

    if (Date.now() > otpExpiry) {
      toast({
        variant: "destructive",
        title: "Code expired",
        description:
          "The verification code has expired. Please click 'Resend' to get a new code.",
      });
      setOtpSent(false);
      setOtpInput("");
      return;
    }

    if (otpInput !== generatedOtp) {
      toast({
        variant: "destructive",
        title: "Incorrect code",
        description: "The code you entered does not match. Please try again.",
      });
      return;
    }

    if (!schoolCodeInput) {
      toast({
        variant: "destructive",
        title: "Missing School Code",
        description: "Enter the code of your school to proceed",
      });
    }

    setIsLoading(true);
    const result = await api.signUp({ email, password, full_name: fullName, role });
    if (result.error) {
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: result.error,
      });
    } 
    else {
      if ((role === "student" || role === "teacher") && schoolCodeInput) {
        try {
          // 1. Fetch the documents from the signup_requests collection safely
          const snap = await getDocs(collection(db, "signup_requests"));
          
          // 2. Find the request matching this user's email via client-side array search
          const matchedDoc = snap.docs.find(d => d.data().email === email);
          
          // 3. If found, update it with the school code
          if (matchedDoc) {
            await setDoc(doc(db, "signup_requests", matchedDoc.id), {
              schoolCode: schoolCodeInput.trim().toUpperCase()
            }, { merge: true });
          }
        } catch (e) {
          console.error("Error linking institutional code to request: ", e);
        }
      }
    }
  };
  /* ---------------- Success screen ---------------- */

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/50 to-background">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="pt-8 pb-6 flex flex-col items-center gap-5 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Request Submitted!</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your email has been verified and your signup request has been sent to the
                admin for approval.
              </p>
              <p className="text-sm text-muted-foreground">
                You'll be able to sign in once the admin approves your account.
              </p>
            </div>
            <Link to="/signin" className="w-full">
              <Button className="w-full">Go to Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------------- Main form ---------------- */

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/50 to-background">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <Link
              to="/"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-primary">
              <img src={logo} className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground"/>
            </div>
            <div className="w-4 sm:w-5" />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold">Create Account</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Join StudyHub and start learning today
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Full Name */}
            <div>
              <Label>Full Name</Label>
              <Input
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={otpSent}
              />
              {errors.fullName && (
                <p className="text-xs text-destructive mt-1">{errors.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <Label>Email</Label>
              <Input
                autoComplete="off"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={otpSent}
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email}</p>
              )}
            </div>

            {/* Password + Send Code Button */}
            <div>
              <Label>Password</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Create a password (min. 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={otpSent}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendOtp}
                  disabled={isSendingOtp || !email.trim()}
                  className="whitespace-nowrap shrink-0"
                >
                  {isSendingOtp ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : otpSent ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Resend
                    </>
                  ) : (
                    <>
                      <Mail className="h-3.5 w-3.5 mr-1" />
                      Send Code
                    </>
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive mt-1">{errors.password}</p>
              )}
            </div>

            {/* OTP Code Input -- shown after code is sent */}
            {otpSent && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-sm font-medium text-primary">
                    Enter the verification code
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  A 6-digit code was sent to{" "}
                  <span className="font-medium">{email}</span>. Enter it below.
                </p>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">6-Digit Code</Label>
                    {countdown > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Expires in {Math.floor(countdown / 60)}:
                        {String(countdown % 60).padStart(2, "0")}
                      </span>
                    ) : (
                      <span className="text-xs text-destructive font-medium">
                        Code expired -- click Resend
                      </span>
                    )}
                  </div>
                  <Input
                    ref={otpInputRef}
                    placeholder="e.g. 482910"
                    value={otpInput}
                    onChange={(e) =>
                      setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    maxLength={6}
                    inputMode="numeric"
                    className="tracking-[0.4em] text-center text-lg font-mono"
                  />
                </div>
              </div>
            )}

            {/* Role Selection */}
            <div>
              <Label className="mb-2 sm:mb-3 block text-sm sm:text-base">
                I am a...
              </Label>
              <RadioGroup
                value={role}
                onValueChange={(v) => setRole(v as AppRole)}
                className="grid grid-cols-2 gap-2 sm:gap-3"
              >
                {/* Student */}
                <Label
                  htmlFor="student"
                  className={`flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all
                    ${
                      role === "student"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                >
                  <RadioGroupItem value="student" id="student" className="sr-only" />
                  <UserCircle
                    className={`h-5 w-5 sm:h-6 sm:w-6 ${
                      role === "student" ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <span className="font-medium text-sm sm:text-base">Student</span>
                </Label>

                {/* Teacher */}
                <Label
                  htmlFor="teacher"
                  className={`flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all
                    ${
                      role === "teacher"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                >
                  <RadioGroupItem value="teacher" id="teacher" className="sr-only" />
                  <BookOpen
                    className={`h-5 w-5 sm:h-6 sm:w-6 ${
                      role === "teacher" ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <span className="font-medium text-sm sm:text-base">Teacher</span>
                </Label>
                {/* School */}
                <Label
                  htmlFor="school"
                  className={`flex flex-col items-center gap-15 sm:gap-2 p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all
                    ${
                      role === "school"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                >
                  <RadioGroupItem value="school" id="school" className="sr-only" />
                  <UserCircle
                    className={`h-5 w-5 sm:h-6 sm:w-6 ${
                      role === "school" ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <span className="font-medium text-sm sm:text-base">School</span>
                </Label>
              </RadioGroup>
            </div>
            {(role === "student" || role === "teacher") && (
              <div className="space-y-2 animate-in fade-in duration-300">
                <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <span>🏫</span> School Verification Code
                  <span className="text-destructive">*</span>
                </label>
                
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g., SH-A4F9X2"
                    value={schoolCodeInput}
                    onChange={(e) => setSchoolCodeInput(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 bg-background border border-input rounded-xl text-sm font-mono tracking-wider uppercase placeholder:normal-case placeholder:tracking-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:border-transparent transition-all"
                    maxLength={9}
                  />
                </div>
                
                <p className="text-xs text-muted-foreground leading-relaxed pl-1">
                  Enter the unique institutional code provided by your school administration. Your account request will be instantly routed to your school dashboard for approval.
                </p>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !otpSent || otpInput.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting request...
                </>
              ) : (
                "Sign Up"
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/signin" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
