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
import { TeamWithUser, PlayerSelection } from "@/types";

interface AdminOverrideTabProps {
  currentRound?: {
    id: string;
    position: string;
    status: string;
    roundNumber: number;
  };
  teamsWithSelection: TeamWithUser[];
  selections: PlayerSelection[];
}

export default function AdminOverrideTab({ currentRound, teamsWithSelection, selections }: AdminOverrideTabProps) {
  const t = useTranslations("auction");
  const { loading, executeAdminAction } = useAdminActions();

  const [overrideAction, setOverrideAction] = useState<"cancel-selection" | "force-resolution" | "reset-round">("cancel-selection");
  const [overrideTeam, setOverrideTeam] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const handleOverride = () => {
    if (!overrideReason.trim()) {
      toast.error(t("admin.reasonRequired"));
      return;
    }

    if (overrideReason.trim().length < 5) {
      toast.error(t("admin.reasonTooShort"));
      return;
    }

    const actionData: { reason: string; targetTeamId?: string } = { reason: overrideReason };
    if (overrideAction === "cancel-selection" && !overrideTeam) {
      toast.error(t("admin.selectTeamToCancel"));
      return;
    }
    if (overrideAction === "cancel-selection") {
      actionData.targetTeamId = overrideTeam;
    }

    executeAdminAction({
      type: overrideAction,
      data: {
        ...actionData,
        roundId: currentRound?.id || "",
      },
    }).then(() => {
      // Reset form on success
      setOverrideTeam("");
      setOverrideReason("");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.overrideControls")}</CardTitle>
        <CardDescription>{t("admin.overrideControlsDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>{t("admin.overrideAction")}</Label>
          <Select value={overrideAction} onValueChange={(value: typeof overrideAction) => setOverrideAction(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cancel-selection">{t("admin.actions.cancelSelection")}</SelectItem>
              <SelectItem value="force-resolution">{t("admin.actions.forceResolution")}</SelectItem>
              <SelectItem value="reset-round">{t("admin.actions.resetRound")}</SelectItem>
            </SelectContent>
          </Select>
          {overrideAction && <p className="text-sm text-muted-foreground mt-1">{t(`admin.descriptions.${overrideAction}`)}</p>}
        </div>

        {overrideAction === "cancel-selection" && (
          <div>
            <Label>{t("admin.teamToCancel")}</Label>
            <Select value={overrideTeam} onValueChange={setOverrideTeam}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.chooseTeam")} />
              </SelectTrigger>
              <SelectContent>
                {teamsWithSelection.map((team) => {
                  const selection = selections.find((s) => s.userId === team.userId);
                  return (
                    <SelectItem key={team.id} value={team.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{team.name}</span>
                        {selection && <Badge variant={selection.isAdminSelection === true ? "destructive" : "default"}>{selection.player?.name || "Unknown Player"}</Badge>}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label>{t("admin.overrideReason")}</Label>
          <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder={t("admin.overrideReasonPlaceholder")} rows={2} required />
        </div>

        <Button onClick={handleOverride} disabled={loading || !overrideReason.trim() || overrideReason.trim().length < 5} variant="destructive" className="w-full">
          {loading ? t("loading") : t("admin.executeOverride")}
        </Button>
      </CardContent>
    </Card>
  );
}
