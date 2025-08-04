"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users } from "lucide-react";

interface ConflictResult {
  playerId: string;
  playerName: string;
  price: number;
  conflicts: Array<{
    teamId: string;
    teamName: string;
    userName: string;
    randomNumber: number;
    isWinner: boolean;
  }>;
}

interface ConflictResolutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: ConflictResult[];
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
                    {conflict.price} crediti
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-gray-600">
                    {t("auction.extractedNumbers")}:
                  </h4>
                  
                  {/* Vincitore */}
                  {conflict.conflicts
                    .filter(c => c.isWinner)
                    .map((winner) => (
                      <div
                        key={winner.teamId}
                        className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-green-600" />
                          <div>
                            <div className="font-semibold text-green-800">
                              {winner.teamName}
                            </div>
                            <div className="text-sm text-green-600">
                              {winner.userName} - {t("auction.teamWon")}
                            </div>
                          </div>
                        </div>
                        <Badge variant="default" className="bg-green-600">
                          {t("auction.randomNumber", { 
                            number: winner.randomNumber, 
                            winner: `🏆` 
                          })}
                        </Badge>
                      </div>
                    ))
                  }

                  {/* Perdenti */}
                  {conflict.conflicts
                    .filter(c => !c.isWinner)
                    .sort((a, b) => b.randomNumber - a.randomNumber)
                    .map((loser) => (
                      <div
                        key={loser.teamId}
                        className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                      >
                        <div>
                          <div className="font-semibold text-red-800">
                            {loser.teamName}
                          </div>
                          <div className="text-sm text-red-600">
                            {loser.userName} - {t("auction.teamLost")}
                          </div>
                        </div>
                        <Badge variant="outline" className="border-red-300 text-red-700">
                          {t("auction.randomNumber", { 
                            number: loser.randomNumber, 
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