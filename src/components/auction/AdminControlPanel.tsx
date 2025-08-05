"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, UserCheck, AlertTriangle, Eye, Bot } from "lucide-react";
import BotManagementTab from "./BotManagementTab";
import AuditTrail from "./AuditTrail";
import AdminStatusOverview from "./AdminStatusOverview";
import AdminSelectionTab from "./AdminSelectionTab";
import AdminOverrideTab from "./AdminOverrideTab";
import AdminConfigTab from "./AdminConfigTab";
import { Player, PlayerSelection, TeamWithUser, AuctionConfig } from "@/types";

interface AdminControlPanelProps {
  leagueId: string;
  currentRound?: {
    id: string;
    position: string;
    status: string;
    roundNumber: number;
  };
  teams: TeamWithUser[];
  availablePlayers: Player[];
  selections: PlayerSelection[];
  config?: AuctionConfig & {
    pauseOnDisconnect?: boolean;
  };
}

export default function AdminControlPanel({ leagueId, currentRound, teams, availablePlayers, selections, config }: AdminControlPanelProps) {
  const t = useTranslations("auction");
  const [activeTab, setActiveTab] = useState<"select" | "override" | "config" | "bot" | "audit">("select");

  const teamsWithoutSelection = teams.filter((team) => !selections.some((selection) => selection.userId === team.userId));
  const teamsWithSelection = teams.filter((team) => selections.some((selection) => selection.userId === team.userId));

  if (!currentRound) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">{t("admin.noActiveRound")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <AdminStatusOverview currentRound={currentRound} teams={teams} selections={selections} availablePlayers={availablePlayers} />

      {/* Control Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: "select", label: t("admin.tabs.select"), icon: UserCheck },
          { id: "override", label: t("admin.tabs.override"), icon: AlertTriangle },
          { id: "config", label: t("admin.tabs.config"), icon: Settings },
          { id: "bot", label: t("admin.tabs.bot"), icon: Bot },
          { id: "audit", label: t("admin.tabs.audit"), icon: Eye },
        ].map((tab) => (
          <Button key={tab.id} variant={activeTab === tab.id ? "default" : "ghost"} size="sm" onClick={() => setActiveTab(tab.id as typeof activeTab)} className="flex items-center gap-2">
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Admin Selection Tab */}
      {activeTab === "select" && <AdminSelectionTab currentRound={currentRound} teamsWithoutSelection={teamsWithoutSelection} availablePlayers={availablePlayers} />}

      {/* Override Controls Tab */}
      {activeTab === "override" && <AdminOverrideTab currentRound={currentRound} teamsWithSelection={teamsWithSelection} selections={selections} />}

      {/* Configuration Tab */}
      {activeTab === "config" && <AdminConfigTab leagueId={leagueId} initialConfig={config} />}

      {/* Bot and Audit Tabs */}
      {activeTab === "bot" && <BotManagementTab leagueId={leagueId} currentRound={currentRound} />}
      {activeTab === "audit" && <AuditTrail leagueId={leagueId} />}
    </div>
  );
}
