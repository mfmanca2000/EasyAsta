"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./language-switcher";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const { data: session, status } = useSession();
  const t = useTranslations();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-primary">
              {t('home.title')}
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
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

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMobileMenu}
              className="p-2"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t bg-background">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <div className="flex justify-center mb-3">
                <LanguageSwitcher />
              </div>
              
              {status === "loading" ? (
                <div className="text-sm text-muted-foreground text-center py-2">
                  {t('common.loading')}
                </div>
              ) : session ? (
                <>
                  <div className="text-center py-2">
                    <span className="text-sm text-muted-foreground">{session.user?.name}</span>
                  </div>
                  <Link href="/dashboard" onClick={toggleMobileMenu}>
                    <Button variant="ghost" className="w-full justify-start">
                      {t('navigation.dashboard')}
                    </Button>
                  </Link>
                  <Link href="/leagues" onClick={toggleMobileMenu}>
                    <Button variant="ghost" className="w-full justify-start">
                      {t('navigation.leagues')}
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      signOut();
                      toggleMobileMenu();
                    }}
                    className="w-full"
                  >
                    {t('auth.signOut')}
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={() => {
                    signIn("google");
                    toggleMobileMenu();
                  }}
                  className="w-full"
                >
                  {t('auth.signInWith', { provider: 'Google' })}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
