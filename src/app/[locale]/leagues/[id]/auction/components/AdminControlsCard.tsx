import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface AdminControlsCardProps {
  onResolveRound: () => void;
  loading: boolean;
}

export default function AdminControlsCard({ onResolveRound, loading }: AdminControlsCardProps) {
  const t = useTranslations();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auction.adminControls")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={onResolveRound} disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {t("auction.resolveRound")}
        </Button>
      </CardContent>
    </Card>
  );
}