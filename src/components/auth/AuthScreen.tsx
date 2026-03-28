"use client";

import * as React from "react";
import { AlertCircle, Building2, Loader2, Lock, Mail, User } from "lucide-react";
import type { AppUser } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SessionEnvelope {
  success: boolean;
  data?: {
    user: AppUser | null;
  };
  error?: string;
}

export function AuthScreen({
  onAuthenticated,
  systemNotice,
}: {
  onAuthenticated: (user: AppUser) => void;
  systemNotice?: string | null;
}) {
  const [mode, setMode] = React.useState<"signin" | "register">("signin");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const payload = (await response.json()) as SessionEnvelope;

      if (!response.ok || !payload.success || !payload.data?.user) {
        throw new Error(payload.error || "Authentication failed");
      }

      onAuthenticated(payload.data.user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-10">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/80 shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl text-white">FRG Builder</CardTitle>
            <CardDescription className="text-slate-400">
              {mode === "register"
                ? "Create your workspace. Your registered email becomes the default sender and reply-to for proposals and follow-ups."
                : "Sign in to access estimates, proposals, CRM, and project operations."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "register" ? (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300">
                  Name
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="border-slate-800 bg-slate-950 pl-10 text-slate-100"
                    placeholder="Your name or company name"
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="border-slate-800 bg-slate-950 pl-10 text-slate-100"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-slate-800 bg-slate-950 pl-10 text-slate-100"
                  placeholder={mode === "register" ? "Create a password" : "Enter your password"}
                  required
                />
              </div>
              {mode === "register" ? (
                <p className="text-xs text-slate-500">
                  Minimum 8 characters. Then you can fine-tune sender profile, SMTP, and agent mode from inside the app.
                </p>
              ) : null}
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {systemNotice ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{systemNotice}</span>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={isLoading || Boolean(systemNotice)}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === "register" ? "Creating workspace" : "Signing in"}
                </>
              ) : (
                mode === "register" ? "Create workspace" : "Sign in"
              )}
            </Button>

            <div className="space-y-2 text-center">
              <p className="text-xs text-slate-500">
                {mode === "register"
                  ? "Your registered email is used as the default identity for proposals and follow-ups."
                  : "You can also create your own workspace if you do not have an account yet."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode((current) => (current === "signin" ? "register" : "signin"));
                }}
                className="text-xs font-medium text-amber-400 transition hover:text-amber-300"
              >
                {mode === "register"
                  ? "Already have an account? Sign in"
                  : "Need your own workspace? Register"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default AuthScreen;
