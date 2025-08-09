import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface NextRoundStats {
  teamStats: Array<{
    teamName: string;
    userName: string;
    composition: { P: number; D: number; C: number; A: number };
    needs: { P: number; D: number; C: number; A: number };
    remainingCredits: number;
  }>;
  globalNeeds: { P: number; D: number; C: number; A: number };
  availableByPosition: { P: number; D: number; C: number; A: number };
  recommendations: { P: boolean; D: boolean; C: boolean; A: boolean };
}

interface NextRoundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextRoundStats: NextRoundStats | null;
  onStartNextRound: (position: "P" | "D" | "C" | "A") => void;
  loading: boolean;
}

export default function NextRoundModal({
  open,
  onOpenChange,
  nextRoundStats,
  onStartNextRound,
  loading,
}: NextRoundModalProps) {
  const t = useTranslations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-none md:max-w-[800px] max-h-[95vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>{t("auction.chooseNextRole")}</DialogTitle>
          <DialogDescription>{t("auction.chooseNextRoleDescription")}</DialogDescription>
        </DialogHeader>

        {nextRoundStats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {(["P", "D", "C", "A"] as const).map((position) => {
                const positionName = t(`auction.positions.${position}`);
                const isRecommended = nextRoundStats.recommendations[position];

                return (
                  <Card 
                    key={position} 
                    className={`cursor-pointer transition-colors ${
                      isRecommended ? "ring-2 ring-green-500" : ""
                    }`}
                  >
                    <CardContent className="p-8 text-center">
                      <div className="space-y-4">
                        <Badge 
                          variant={isRecommended ? "default" : "outline"} 
                          className="text-lg px-4 py-1.5"
                        >
                          {position}
                        </Badge>
                        <h3 className="font-medium text-lg">{positionName}</h3>
                        <div className="text-sm text-muted-foreground space-y-1.5">
                          <div>
                            {t("auction.needed", { count: nextRoundStats.globalNeeds[position] })}
                          </div>
                          <div>
                            {t("auction.availableCount", { 
                              count: nextRoundStats.availableByPosition[position] 
                            })}
                          </div>
                        </div>
                        <Button
                          size="default"
                          variant={isRecommended ? "default" : "outline"}
                          disabled={(nextRoundStats?.availableByPosition?.[position] ?? 0) === 0 || loading}
                          onClick={() => onStartNextRound(position)}
                          className="w-full h-auto py-3 px-4 text-sm whitespace-normal"
                        >
                          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {t("auction.startRound")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Team details */}
            <div className="mt-8">
              <h4 className="font-medium mb-4 text-lg">{t("auction.teamsSituation")}</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {nextRoundStats.teamStats.map((team, index) => (
                  <div key={index} className="flex items-center justify-between text-sm p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{team.teamName}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {team.remainingCredits}€
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      {(["P", "D", "C", "A"] as const).map((pos) => (
                        <span 
                          key={pos} 
                          className={team.needs[pos] > 0 ? "text-orange-600 font-medium" : "text-green-600"}
                        >
                          {pos}: {team.composition[pos]}/{pos === "P" ? 3 : pos === "A" ? 6 : 8}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}