"use client";

import { useSession } from "next-auth/react";
import { redirect } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const locale = useLocale();
  const t = useTranslations();

  if (status === "loading") {
    return <div className="text-center">{t("common.loading")}</div>;
  }

  if (!session) {
    redirect({ href: "/", locale });
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground">{t("dashboard.welcome", { name: session?.user?.name as string })}</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.myLeagues")}</CardTitle>
            <CardDescription>{t("dashboard.leaguesDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{t("dashboard.noLeagueFound")}</p>
            <Button variant="outline" className="w-full">
              {t("dashboard.joinLeague")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.myTeams")}</CardTitle>
            <CardDescription>{t("dashboard.teamsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{t("dashboard.noTeamFound")}</p>
            <Button variant="outline" className="w-full">
              {t("dashboard.viewRosters")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.activeAuctions")}</CardTitle>
            <CardDescription>{t("dashboard.auctionsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{t("dashboard.noActiveAuction")}</p>
            <Button variant="outline" className="w-full">
              {t("dashboard.searchAuctions")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
