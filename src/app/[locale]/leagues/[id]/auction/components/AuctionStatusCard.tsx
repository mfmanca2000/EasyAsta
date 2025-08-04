import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface UserSelection {
  player: {
    name: string;
  };
  randomNumber?: number;
  isWinner: boolean;
}

interface AuctionStatusCardProps {
  userSelection: UserSelection | null | undefined;
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
          {t("auction.selectedPlayer", { playerName: userSelection.player.name })}
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