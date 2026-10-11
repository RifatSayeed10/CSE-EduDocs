import React from "react";
import { KeyRound, Mail, User, BookOpen, AlertCircle, CheckCircle, HelpCircle, RefreshCw } from "lucide-react";
import { api } from "../lib/api";

type AuthTab = "signin" | "register" | "forgot";

interface AuthViewProps {
  initialTab?: "signin" | "register";
  onAuthSuccess: (user: any, token: string) => void;
  onToggleTab: (tab: "signin" | "register") => void;
}

export default function AuthView({
  initialTab = "signin",
  onAuthSuccess,
  onToggleTab
}: AuthViewProps) {
  const [tab, setTab] = React.useState<AuthTab>(initialTab);
  
  // Login Inputs
  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  
  // Register Inputs
  const [registerEmail, setRegisterEmail] = React.useState("");
  const [registerName, setRegisterName] = React.useState("");
  const [registerPassword, setRegisterPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [registerRole, setRegisterRole] = React.useState<"student" | "teacher">("student");

  // Forgot Password / Reset Inputs
  const [forgotEmail, setForgotEmail] = React.useState("");
  const [resetCode, setResetCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [recoveryCodeReceived, setRecoveryCodeReceived] = React.useState(false);
  const [simulatedCode, setSimulatedCode] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");

  React.useEffect(() => {
    setTab(initialTab);
    setErrorMsg("");
    setSuccessMsg("");
    setRecoveryCodeReceived(false);
  }, [initialTab]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await api.login({
        email: loginEmail.trim(),
        password: loginPassword
      });

      setSuccessMsg("Session authenticated. Loading dashboard indices...");
      localStorage.setItem("research_archive_token", res.token);
      
      setTimeout(() => {
        onAuthSuccess(res.user, res.token);
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to authenticate session credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerEmail || !registerName || !registerPassword) return;

    if (registerPassword.length < 6) {
      setErrorMsg("Password requirement: Must be at least 6 characters.");
      return;
    }

    if (registerPassword !== confirmPassword) {
      setErrorMsg("Password confirmation mismatch. Please retype password.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await api.register({
        email: registerEmail.trim(),
        name: registerName.trim(),
        password: registerPassword,
        role: registerRole
      });

      setSuccessMsg("Account spawned! Dispatching sign-in credentials...");
      localStorage.setItem("research_archive_token", res.token);

      setTimeout(() => {
        onAuthSuccess(res.user, res.token);
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Registration sequence failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await api.forgotPassword(forgotEmail.trim());
      if (res.simulated && res.code) {
        setSimulatedCode(res.code);
        setResetCode(res.code); // Pre-fill for ease of use
        setRecoveryCodeReceived(true);
        setSuccessMsg(`[Dev mode] Your reset code is ${res.code}.`);
      } else {
        setSuccessMsg(res.message || "If an account exists for that email, a reset code has been created. Get the code from the department admin.");
        setRecoveryCodeReceived(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Could not request a reset code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !resetCode || !newPassword) return;

    if (newPassword.length < 6) {
      setErrorMsg("Password must contain at least 6 letters.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await api.resetPassword({
        email: forgotEmail.trim(),
        code: resetCode.trim(),
        newPassword
      });
      setSuccessMsg(res.message || "Password updated. Redirecting to login tab...");
      setTimeout(() => {
        setTab("signin");
        setErrorMsg("");
        setSuccessMsg("");
        setForgotEmail("");
        setResetCode("");
        setNewPassword("");
        setRecoveryCodeReceived(false);
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Could not reset the password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-8 sm:py-12 font-sans">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-md space-y-6">
        
        {/* Head Branding Header */}
        <div className="text-center space-y-2 select-none">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-xs mb-1">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
            {tab === "signin" && "Sign In to Archive"}
            {tab === "register" && "Create Researcher Account"}
            {tab === "forgot" && "Recover Account Password"}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Dept of CSE, PUST
          </p>
        </div>

        {/* Tab Triggers */}
        {tab !== "forgot" && (
          <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
            <button
              onClick={() => {
                setTab("signin");
                onToggleTab("signin");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className={`rounded-lg py-2 text-xs font-semibold font-sans transition-all cursor-pointer ${
                tab === "signin"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setTab("register");
                onToggleTab("register");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className={`rounded-lg py-2 text-xs font-semibold font-sans transition-all cursor-pointer ${
                tab === "register"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900"
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Forms box */}
        {tab === "signin" && (
          <form onSubmit={handleLoginSubmit} className="space-y-4" id="login-form">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Email Address
              </label>
              <div className="relative flex items-center">
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="student@pust.ac.bd"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 focus:ring-2 focus:ring-zinc-100 font-sans transition-all"
                />
                <Mail className="absolute left-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTab("forgot");
                    setErrorMsg("");
                    setSuccessMsg("");
                  }}
                  className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative flex items-center">
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 focus:ring-2 focus:ring-zinc-100 font-sans transition-all"
                />
                <KeyRound className="absolute left-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-red-700 dark:text-red-300 text-xs font-medium" id="login-error">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-emerald-700 dark:text-emerald-300 text-xs font-medium" id="login-success">
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 py-2.5 text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer text-center"
            >
              {loading ? "Authenticating..." : "Sign In to Archive"}
            </button>
          </form>
        )}

        {tab === "register" && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4" id="register-form">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Full Legal Name
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="e.g. Shakil Ahmed"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 focus:ring-2 focus:ring-zinc-100 font-sans transition-all"
                />
                <User className="absolute left-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Institutional Email
              </label>
              <div className="relative flex items-center">
                <input
                  type="email"
                  required
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="student@pust.ac.bd"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 focus:ring-2 focus:ring-zinc-100 font-sans transition-all"
                />
                <Mail className="absolute left-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Password
              </label>
              <div className="relative flex items-center">
                <input
                  type="password"
                  required
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 focus:ring-2 focus:ring-zinc-100 font-sans transition-all"
                />
                <KeyRound className="absolute left-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Confirm Password
              </label>
              <div className="relative flex items-center">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Retype password"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 focus:ring-2 focus:ring-zinc-100 font-sans transition-all"
                />
                <KeyRound className="absolute left-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Academic Role
              </label>
              <div className="grid grid-cols-2 gap-3" id="role-select-box">
                <button
                  type="button"
                  onClick={() => setRegisterRole("student")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold cursor-pointer select-none transition-all ${
                    registerRole === "student"
                      ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Student / Researcher
                </button>
                <button
                  type="button"
                  onClick={() => setRegisterRole("teacher")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold cursor-pointer select-none transition-all ${
                    registerRole === "teacher"
                      ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Faculty / Supervisor
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-red-700 dark:text-red-300 text-xs font-medium" id="register-error">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-emerald-700 dark:text-emerald-300 text-xs font-medium" id="register-success">
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 py-2.5 text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        )}

        {tab === "forgot" && (
          <div className="space-y-4">
            {!recoveryCodeReceived ? (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 p-3.5 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans">
                  Enter your registered institutional email to receive a password reset verification code.
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="student@pust.ac.bd"
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 focus:ring-2 focus:ring-zinc-100 font-sans transition-all"
                    />
                    <Mail className="absolute left-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                {errorMsg && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 p-3 text-red-700 dark:text-red-300 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTab("signin");
                      setErrorMsg("");
                      setSuccessMsg("");
                    }}
                    className="w-1/3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 py-2.5 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-semibold text-xs py-2.5 transition shadow-xs hover:shadow cursor-pointer"
                  >
                    {loading ? "Sending..." : "Request Reset Key"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed font-semibold">
                  {successMsg || "Verification code dispatched. Enter the code and your new password below."}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Enter Verification Code
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      placeholder="e.g. 583192"
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 focus:ring-2 focus:ring-zinc-100 font-mono tracking-widest font-bold text-center"
                    />
                    <RefreshCw className="absolute left-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    New Password
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:bg-white focus:border-zinc-900 focus:ring-2 focus:ring-zinc-100 font-sans transition-all"
                    />
                    <KeyRound className="absolute left-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                {errorMsg && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 p-3 text-red-700 dark:text-red-300 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                {successMsg && (
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 p-3 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                    {successMsg}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryCodeReceived(false);
                      setSuccessMsg("");
                      setErrorMsg("");
                    }}
                    className="w-1/3 rounded-lg border border-zinc-300 dark:border-zinc-700 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-semibold text-xs py-2.5 shadow-xs transition cursor-pointer"
                  >
                    {loading ? "Resetting..." : "Set New Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
