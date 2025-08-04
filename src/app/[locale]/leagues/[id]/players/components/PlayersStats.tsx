import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, UserX, TrendingUp } from "lucide-react";

interface Player {
  id: string;
  name: string;
  position: "P" | "D" | "C" | "A";
  realTeam: string;
  price: number;
  isAssigned: boolean;
}

interface PlayersStatsProps {
  players: Player[];
  leagueStatus: "SETUP" | "AUCTION" | "COMPLETED";
}

export default function PlayersStats({ players, leagueStatus }: PlayersStatsProps) {
  const t = useTranslations();

  // Calculate comprehensive stats from players data
  const calculatedStats = useMemo(() => {
    const total = players.length;
    const assigned = players.filter(p => p.isAssigned).length;
    const available = total - assigned;
    
    const totalValue = players.reduce((sum, p) => sum + p.price, 0);
    const assignedValue = players.filter(p => p.isAssigned).reduce((sum, p) => sum + p.price, 0);
    const availableValue = totalValue - assignedValue;

    // Calculate by position
    const byPosition = {
      P: { total: 0, assigned: 0, available: 0 },
      D: { total: 0, assigned: 0, available: 0 },
      C: { total: 0, assigned: 0, available: 0 },
      A: { total: 0, assigned: 0, available: 0 },
    };

    players.forEach(player => {
      const pos = player.position;
      byPosition[pos].total += 1;
      if (player.isAssigned) {
        byPosition[pos].assigned += 1;
      } else {
        byPosition[pos].available += 1;
      }
    });

    return {
      total,
      assigned,
      available,
      totalValue,
      assignedValue,
      availableValue,
      byPosition,
    };
  }, [players]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT').format(value);
  };

  const getStatusColor = (status: typeof leagueStatus) => {
    switch (status) {
      case "SETUP": return "bg-blue-100 text-blue-800";
      case "AUCTION": return "bg-green-100 text-green-800";
      case "COMPLETED": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Players */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t('players.totalPlayers')}
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{calculatedStats.total}</div>
          <p className="text-xs text-muted-foreground">
            {t('players.totalValue')}: {formatCurrency(calculatedStats.totalValue)}
          </p>
        </CardContent>
      </Card>

      {/* Available Players */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t('players.available')}
          </CardTitle>
          <UserX className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{calculatedStats.available}</div>
          <p className="text-xs text-muted-foreground">
            {t('players.value')}: {formatCurrency(calculatedStats.availableValue)}
          </p>
        </CardContent>
      </Card>

      {/* Assigned Players */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t('players.assigned')}
          </CardTitle>
          <UserCheck className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{calculatedStats.assigned}</div>
          <p className="text-xs text-muted-foreground">
            {t('players.value')}: {formatCurrency(calculatedStats.assignedValue)}
          </p>
        </CardContent>
      </Card>

      {/* League Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t('common.status')}
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Badge className={getStatusColor(leagueStatus)}>
            {t(`league.status.${leagueStatus.toLowerCase()}`)}
          </Badge>
          <p className="text-xs text-muted-foreground mt-2">
            {calculatedStats.assigned > 0 && (
              <>
                {((calculatedStats.assigned / calculatedStats.total) * 100).toFixed(1)}% {t('players.completion')}
              </>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Position Breakdown */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {t('players.byPosition')}
          </CardTitle>
          <CardDescription>
            {t('players.positionBreakdown')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(["P", "D", "C", "A"] as const).map((position) => {
              const positionData = calculatedStats.byPosition[position];
              const percentage = positionData.total > 0 
                ? ((positionData.assigned / positionData.total) * 100).toFixed(1)
                : "0";

              return (
                <div key={position} className="text-center space-y-2">
                  <div className="font-medium text-lg">
                    {t(`players.positions.${position}`)}
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">
                      {positionData.total}
                    </div>
                    <div className="flex justify-center gap-2 text-sm">
                      <span className="text-green-600">
                        {positionData.available} {t('players.free')}
                      </span>
                      <span className="text-blue-600">
                        {positionData.assigned} {t('players.taken')}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {percentage}% {t('players.assigned')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}