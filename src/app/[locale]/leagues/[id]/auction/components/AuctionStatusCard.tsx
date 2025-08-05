import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlayerSelection } from "@/types";

interface AuctionStatusCardProps {
  userSelection: PlayerSelection | null | undefined;
}

export default function AuctionStatusCard({ userSelection }: AuctionStatusCardProps) {
  const t = useTranslations();

  if (!userSelection) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-green-600">
          {t("auction.selectedPlayer", { playerName: userSelection.player?.name || "Unknown Player" })}
        </CardTitle>
        <CardDescription>
          {userSelection.randomNumber 
            ? t("auction.randomNumber", { 
                number: userSelection.randomNumber, 
                winner: userSelection.isWinner ? "🏆" : "" 
              }) 
            : t("auction.waitingForOthers")
          }
        </CardDescription>
      </CardHeader>
    </Card>
  );
}