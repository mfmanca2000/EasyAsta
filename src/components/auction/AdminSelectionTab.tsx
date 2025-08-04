"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAdminActions } from "@/hooks/useAdminActions";

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

interface Player {
  id: string;
  name: string;
  position: string;
  realTeam: string;
  price: number;
}

interface AdminSelectionTabProps {
  currentRound?: {
    id: string;
    position: string;
    status: string;
    roundNumber: number;
  };
  teamsWithoutSelection: Team[];
  availablePlayers: Player[];
}

export default function AdminSelectionTab({ 
  currentRound, 
  teamsWithoutSelection, 
  availablePlayers 
}: AdminSelectionTabProps) {
  const t = useTranslations("auction");
  const { loading, executeAdminAction } = useAdminActions();
  
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [adminReason, setAdminReason] = useState("");

  const handleAdminSelect = () => {
    if (!selectedTeam || !selectedPlayer) {
      toast.error(t("admin.selectTeamAndPlayer"));
      return;
    }

    executeAdminAction({
      type: "admin-select",
      data: {
        roundId: currentRound?.id,
        playerId: selectedPlayer,
        targetTeamId: selectedTeam,
        reason: adminReason || t("admin.defaultReason"),
      },
    }).then(() => {
      // Reset form on success
      setSelectedTeam("");
      setSelectedPlayer("");
      setAdminReason("");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.selectForTeam")}</CardTitle>
        <CardDescription>{t("admin.selectForTeamDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{t("admin.selectTeam")}</Label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.chooseTeam")} />
              </SelectTrigger>
              <SelectContent>
                {teamsWithoutSelection.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{team.name}</span>
                      <Badge variant="outline">
                        {team.remainingCredits} {t("admin.credits")}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t("admin.selectPlayer")}</Label>
            <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.choosePlayer")} />
              </SelectTrigger>
              <SelectContent>
                {availablePlayers.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>
                        {player.name} ({player.realTeam})
                      </span>
                      <Badge variant="outline">
                        {player.price} {t("admin.credits")}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>{t("admin.reason")}</Label>
          <Textarea 
            value={adminReason} 
            onChange={(e) => setAdminReason(e.target.value)} 
            placeholder={t("admin.reasonPlaceholder")} 
            rows={2} 
          />
        </div>

        <Button 
          onClick={handleAdminSelect} 
          disabled={loading || !selectedTeam || !selectedPlayer} 
          className="w-full"
        >
          {loading ? t("loading") : t("admin.executeSelection")}
        </Button>
      </CardContent>
    </Card>
  );
}