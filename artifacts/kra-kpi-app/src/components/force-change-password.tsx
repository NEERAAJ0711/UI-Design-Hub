import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useChangePassword } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  KeyRound, Eye, EyeOff, CheckCircle2, ShieldCheck, LogOut,
} from "lucide-react";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(6, "Minimum 6 characters"),
    confirm: z.string().min(1, "Please confirm"),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

type FormValues = z.infer<typeof schema>;

export function ForceChangePassword() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const changePwd = useChangePassword();

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  const newPwd = form.watch("newPassword");

  const strengthChecks = [
    { label: "6+ characters",     ok: newPwd.length >= 6 },
    { label: "Uppercase letter",   ok: /[A-Z]/.test(newPwd) },
    { label: "Lowercase letter",   ok: /[a-z]/.test(newPwd) },
    { label: "Number or symbol",   ok: /[\d\W]/.test(newPwd) },
  ];

  async function onSubmit(values: FormValues) {
    try {
      await changePwd.mutateAsync({
        data: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      });
      toast({ title: "Password changed successfully", description: "Welcome to the system!" });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    } catch {
      form.setError("currentPassword", { message: "Current password is incorrect" });
    }
  }

  return (
    <div className="min-h-screen flex bg-[#0f1e3d]">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 px-12 py-10
                      bg-gradient-to-b from-[#0a1628] to-[#0f2354] border-r border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
          </div>
          <span className="text-white/80 font-semibold text-sm tracking-wide">RPS Infrastructure Limited</span>
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-300">
            <KeyRound className="h-3.5 w-3.5" />
            Security Requirement
          </div>
          <h1 className="text-3xl font-bold text-white leading-snug">
            Set a new<br />
            <span className="text-amber-400">secure password</span>
          </h1>
          <p className="text-white/55 text-sm leading-relaxed">
            Your account is using a default or recently reset password.
            Please choose a new password to continue.
          </p>

          <ul className="mt-6 space-y-3">
            {[
              "Choose something memorable but hard to guess",
              "Mix uppercase, lowercase, and numbers",
              "At least 6 characters required",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2.5 text-sm text-white/60">
                <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-white/30 text-xs">© 2026 RPS Infrastructure Limited</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <KeyRound className="h-4 w-4 text-amber-400" />
            </div>
            <span className="text-white/80 font-semibold text-sm">RPS Infrastructure Limited</span>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm px-8 py-9 shadow-2xl space-y-6">
            <div>
              <p className="text-white/50 text-xs font-medium tracking-wider uppercase mb-1">
                Signed in as
              </p>
              <p className="text-white font-semibold truncate">{user?.name}</p>
              <p className="text-white/40 text-sm truncate">{user?.email}</p>
            </div>

            <div className="h-px bg-white/10" />

            <div>
              <h2 className="text-white text-lg font-bold">Change your password</h2>
              <p className="text-white/45 text-sm mt-1">
                This is required before you can access the system.
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Current password */}
                <FormField control={form.control} name="currentPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 text-xs">Current Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showCurrent ? "text" : "password"}
                          placeholder="Your current / default password"
                          className="bg-white/8 border-white/20 text-white placeholder:text-white/25 focus-visible:ring-amber-500/50 pr-9"
                          {...field}
                        />
                        <button type="button" tabIndex={-1}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                          onClick={() => setShowCurrent((v) => !v)}>
                          {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )} />

                {/* New password */}
                <FormField control={form.control} name="newPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 text-xs">New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showNew ? "text" : "password"}
                          placeholder="Min. 6 characters"
                          className="bg-white/8 border-white/20 text-white placeholder:text-white/25 focus-visible:ring-amber-500/50 pr-9"
                          {...field}
                        />
                        <button type="button" tabIndex={-1}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                          onClick={() => setShowNew((v) => !v)}>
                          {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )} />

                {/* Strength indicators */}
                {newPwd.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {strengthChecks.map(({ label, ok }) => (
                      <div key={label} className={`flex items-center gap-1.5 text-xs ${ok ? "text-green-400" : "text-white/30"}`}>
                        <CheckCircle2 className={`h-3 w-3 shrink-0 ${ok ? "text-green-400" : "text-white/20"}`} />
                        {label}
                      </div>
                    ))}
                  </div>
                )}

                {/* Confirm */}
                <FormField control={form.control} name="confirm" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 text-xs">Confirm New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirm ? "text" : "password"}
                          placeholder="Re-enter new password"
                          className="bg-white/8 border-white/20 text-white placeholder:text-white/25 focus-visible:ring-amber-500/50 pr-9"
                          {...field}
                        />
                        <button type="button" tabIndex={-1}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                          onClick={() => setShowConfirm((v) => !v)}>
                          {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )} />

                <Button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-[#0a1628] font-semibold mt-2"
                  disabled={changePwd.isPending}>
                  {changePwd.isPending ? "Saving…" : "Set New Password & Continue"}
                </Button>
              </form>
            </Form>

            <div className="flex justify-center">
              <button
                onClick={() => logout()}
                className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
                <LogOut className="h-3.5 w-3.5" />
                Sign out and use a different account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
