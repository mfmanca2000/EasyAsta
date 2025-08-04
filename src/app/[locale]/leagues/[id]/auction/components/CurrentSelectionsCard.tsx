import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";

interface Selection {
  id: string;
  user: {
    name: string;
  };
  player: {
    name: string;
    realTeam: string;
    price: number;
  };
  randomNumber?: number;
  isWinner: boolean;
}

interface CurrentSelectionsCardProps {
  selections: Selection[];
}

export default function CurrentSelectionsCard({ selections }: CurrentSelectionsCardProps) {
  const t = useTranslations();

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
          {selections.map((selection) => (
            <div key={selection.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <span className="font-medium">{selection.user.name}</span>
                <span className="mx-2">→</span>
                <span>{selection.player.name}</span>
                <span className="text-muted-foreground ml-2">({selection.player.realTeam})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <Coins className="w-3 h-3" />
                  {selection.player.price}
                </span>
                {selection.randomNumber && (
                  <Badge variant={selection.isWinner ? "default" : "secondary"}>
                    {selection.randomNumber} {selection.isWinner && "🏆"}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}