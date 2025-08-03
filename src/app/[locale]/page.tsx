"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const { data: session } = useSession();
  const t = useTranslations();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-primary mb-4">{t("home.title")}</h1>
        <p className="text-xl text-muted-foreground">{t("home.subtitle")}</p>
        <p className="text-muted-foreground mt-2">{t("home.description")}</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">⚡ {t("home.features.realTime.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>{t("home.features.realTime.description")}</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">🎯 {t("home.features.autoConflict.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>{t("home.features.autoConflict.description")}</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">👥 {t("home.features.teamManagement.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>{t("home.features.teamManagement.description")}</CardDescription>
          </CardContent>
        </Card>
      </div>

      {session ? (
        <div className="text-center">
          <p className="text-lg mb-6">
            {t("auth.welcome")}, <span className="font-semibold">{session.user?.name}</span>!
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg">{t("navigation.dashboard")}</Button>
            </Link>
            {session.user?.role === "ADMIN" && (
              <Link href="/admin">
                <Button variant="outline" size="lg">
                  {t("navigation.admin")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>{t("home.getStarted")}</CardTitle>
            <CardDescription>{t("auth.signInToAccess")}</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
