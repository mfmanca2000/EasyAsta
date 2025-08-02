"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./language-switcher";

export function Navbar() {
  const { data: session, status } = useSession();
  const t = useTranslations();

  return (
    <nav className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-primary">
              {t('home.title')}
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            {status === "loading" ? (
              <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
            ) : session ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost">{t('navigation.dashboard')}</Button>
                </Link>
                <Link href="/leagues">
                  <Button variant="ghost">{t('navigation.leagues')}</Button>
                </Link>
                {session.user?.role === "ADMIN" && (
                  <Link href="/admin">
                    <Button variant="ghost">{t('navigation.admin')}</Button>
                  </Link>
                )}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">{session.user?.name}</span>
                  <Button variant="outline" onClick={() => signOut()}>
                    {t('auth.signOut')}
                  </Button>
                </div>
              </>
            ) : (
              <Button onClick={() => signIn("google")}>
                {t('auth.signInWith', { provider: 'Google' })}
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
