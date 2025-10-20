"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getClientLocale, tr } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { sendVerificationEmail, reloadCurrentUser, signOut, isCurrentUserVerified } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function VerifyPage() {
  const locale = getClientLocale();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const onResend = async () => {
    try {
      if (!user) {
        router.push("/login");
        return;
      }
      setSending(true);
      await sendVerificationEmail(user);
      toast({
        title: tr(locale, "login.toasts.verifyEmailSentTitle"),
        description: tr(locale, "login.toasts.verifyEmailSentDesc"),
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    } finally {
      setSending(false);
    }
  };

  // Auto-check every 5s so the page can move on right after verification
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        await reloadCurrentUser();
        if (isCurrentUserVerified()) {
          toast({ title: tr(locale, "verify.verifiedTitle"), description: tr(locale, "verify.verifiedDesc") });
          if (userProfile?.role === "provider") router.replace("/dashboard");
          else router.replace("/");
        }
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [router, userProfile?.role]);

  const onUseDifferentEmail = async () => {
    try {
      setSigningOut(true);
      await signOut();
      router.replace("/login");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    } finally {
      setSigningOut(false);
    }
  };

  const onRefresh = async () => {
    try {
      setChecking(true);
      await reloadCurrentUser();
      if (isCurrentUserVerified() || user?.emailVerified) {
        toast({
          title: tr(locale, "verify.verifiedTitle"),
          description: tr(locale, "verify.verifiedDesc"),
        });
        if (userProfile?.role === "provider") router.replace("/dashboard");
        else router.replace("/");
        return;
      }
      toast({
        variant: "destructive",
        title: tr(locale, "verify.notVerifiedTitle"),
        description: tr(locale, "verify.notVerifiedDesc"),
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="container py-10">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>{tr(locale, "verify.title")}</CardTitle>
          <CardDescription>
            {tr(locale, "verify.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user ? (
            <p className="text-sm text-muted-foreground">
              {user.email}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link href="/login" className="underline">
                Login
              </Link>
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button onClick={onResend} disabled={sending || !user} variant="secondary">
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr(locale, "verify.resend")}
            </Button>
            <Button onClick={onRefresh} disabled={checking || !user}>
              {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr(locale, "verify.check")}
            </Button>
            <Button onClick={onUseDifferentEmail} disabled={signingOut} variant="outline">
              {signingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {locale === 'ar' ? 'استخدم بريدًا مختلفًا' : 'Use a different email'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
