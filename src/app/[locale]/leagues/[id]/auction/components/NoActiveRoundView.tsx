import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trophy, Users, Loader2, ArrowLeft } from "lucide-react";

interface NoActiveRoundViewProps {
  isAdmin: boolean;
  teamCount: number;
  loading: boolean;
  onOpenNextRoundModal: () => void;
  onResetAuction: () => void;
}

export default function NoActiveRoundView({
  isAdmin,
  teamCount,
  loading,
  onOpenNextRoundModal,
  onResetAuction,
}: NoActiveRoundViewProps) {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;

  return (
    <div className="container mx-auto p-6">
      {/* Back Button */}
      <div className="mb-4">
        <Button 
          onClick={() => router.push(`/${params.locale}/leagues/${leagueId}`)} 
          variant="outline" 
          size="sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("common.back")}
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            {t("auction.title")}
          </CardTitle>
          <CardDescription>{t("auction.noActiveRound")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-sm">+</span>
                  </div>
                  <h3 className="font-semibold text-lg">{t("auction.continueAuction")}</h3>
                </div>

                {teamCount < 4 && (
                  <Alert>
                    <AlertDescription>
                      {t("auction.insufficientTeams", { count: teamCount })}
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-muted-foreground text-sm">
                  {t("auction.chooseNextRoleTooltip")}
                </p>

                <Button
                  onClick={onOpenNextRoundModal}
                  disabled={loading || teamCount < 4}
                  size="lg"
                  className="w-full"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Trophy className="w-4 h-4 mr-2" />
                  {t("auction.startNextRound")}
                </Button>
              </div>

              {/* Sezione Reset - Solo se asta già iniziata */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 font-bold text-xs">!</span>
                  </div>
                  <h4 className="font-medium text-sm text-red-700">
                    {t("auction.dangerZone")}
                  </h4>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(t("auction.resetConfirmation"))) {
                      onResetAuction();
                    }
                  }}
                  disabled={loading}
                  className="w-full"
                >
                  🗑️ {t("auction.resetComplete")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-muted-foreground">
                {t("auction.waitForAdmin", {
                  action: t("auction.startNextRoundAction"),
                })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}