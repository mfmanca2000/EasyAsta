"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

interface Team {
  id: string;
  name: string;
  userId: string;
  remainingCredits: number;
  user: {
    id: string;
    name?: string;
    email: string;
  };
}

interface Selection {
  id: string;
  userId: string;
  playerId: string;
  isAdminSelection?: boolean;
  adminReason?: string;
  user: {
    id: string;
    name?: string;
  };
  player: {
    id: string;
    name: string;
    position: string;
    realTeam: string;
    price: number;
  };
  randomNumber?: number;
  isWinner: boolean;
}

interface AdminStatusOverviewProps {
  currentRound: {
    id: string;
    position: string;
    status: string;
    roundNumber: number;
  };
  teams: Team[];
  selections: Selection[];
  availablePlayers: Array<{
    id: string;
    name: string;
    position: string;
    realTeam: string;
    price: number;
  }>;
}

export default function AdminStatusOverview({ 
  currentRound, 
  teams, 
  selections, 
  availablePlayers 
}: AdminStatusOverviewProps) {
  const t = useTranslations("auction");

  const teamsWithSelection = teams.filter((team) => 
    selections.some((selection) => selection.userId === team.userId)
  );
  const teamsWithoutSelection = teams.filter((team) => 
    !selections.some((selection) => selection.userId === team.userId)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t("admin.controlPanel")}
        </CardTitle>
        <CardDescription>
          {t("admin.roundInfo", {
            round: currentRound.roundNumber,
            position: currentRound.position,
            status: currentRound.status,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{teamsWithSelection.length}</div>
            <div className="text-sm text-muted-foreground">{t("admin.teamsSelected")}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{teamsWithoutSelection.length}</div>
            <div className="text-sm text-muted-foreground">{t("admin.teamsPending")}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{availablePlayers.length}</div>
            <div className="text-sm text-muted-foreground">{t("admin.playersAvailable")}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}