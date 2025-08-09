import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";
import { PlayerSelection } from "@/types";

interface CurrentSelectionsCardProps {
  selections: PlayerSelection[];
}

export default function CurrentSelectionsCard({ selections }: CurrentSelectionsCardProps) {
  const t = useTranslations();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  if (selections.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auction.roundSelections")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {selections.map((selection) => {
            const isOwnSelection = selection.userId === currentUserId;
            const showPlayerName = isOwnSelection || selection.isWinner;
            
            return (
              <div key={selection.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-medium">{selection.user?.name || selection.user?.email || "Unknown User"}</span>
                  <span className="mx-2">→</span>
                  {showPlayerName ? (
                    <>
                      <span>{selection.player?.name || "Unknown Player"}</span>
                      {selection.player?.realTeam && (
                        <span className="text-muted-foreground ml-2">({selection.player.realTeam})</span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground italic">{t("auction.playerSelected")}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {showPlayerName && selection.player?.price && (
                    <span className="flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      {selection.player.price}
                    </span>
                  )}
                  {selection.randomNumber && (
                    <Badge variant={selection.isWinner ? "default" : "secondary"}>
                      {selection.randomNumber} {selection.isWinner && "🏆"}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}