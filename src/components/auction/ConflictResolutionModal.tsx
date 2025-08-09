"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users } from "lucide-react";
import { ConflictResolution } from "@/types";

interface ConflictResolutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: ConflictResolution[];
  roundContinues: boolean;
}

export default function ConflictResolutionModal({
  open,
  onOpenChange,
  conflicts,
  roundContinues
}: ConflictResolutionModalProps) {
  const t = useTranslations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("auction.conflictResolutionTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("auction.conflictResolutionDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {conflicts.map((conflict) => (
            <Card key={conflict.playerId}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {conflict.playerName}
                  <Badge variant="outline" className="ml-2">
                    {conflict.winner?.player?.price || 0} crediti
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-gray-600">
                    {t("auction.extractedNumbers")}:
                  </h4>
                  
                  {/* Vincitore */}
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-green-600" />
                      <div>
                        <div className="font-semibold text-green-800">
                          {conflict.winner?.user?.name || conflict.winner?.user?.email || "Unknown User"}
                        </div>
                        <div className="text-sm text-green-600">
                          {t("auction.teamWon")}
                        </div>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-green-600">
                      {t("auction.randomNumber", { 
                        number: conflict.winner?.userId ? (conflict.randomNumbers[conflict.winner.userId] || conflict.winner?.randomNumber || 0) : 0, 
                        winner: `🏆` 
                      })}
                    </Badge>
                  </div>

                  {/* Perdenti */}
                  {conflict.conflictedSelections
                    .filter(selection => selection.userId !== conflict.winner?.userId)
                    .sort((a, b) => (conflict.randomNumbers?.[b.userId] || 0) - (conflict.randomNumbers?.[a.userId] || 0))
                    .map((loser) => (
                      <div
                        key={loser.userId}
                        className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                      >
                        <div>
                          <div className="font-semibold text-red-800">
                            {loser.user?.name || loser.user?.email || "Unknown User"}
                          </div>
                          <div className="text-sm text-red-600">
                            {t("auction.teamLost")}
                          </div>
                        </div>
                        <Badge variant="outline" className="border-red-300 text-red-700">
                          {t("auction.randomNumber", { 
                            number: conflict.randomNumbers?.[loser.userId] || loser.randomNumber || 0, 
                            winner: `` 
                          })}
                        </Badge>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          ))}

          {roundContinues && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 font-medium">
                {t("auction.continueRound")}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}