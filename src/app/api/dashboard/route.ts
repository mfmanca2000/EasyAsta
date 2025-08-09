import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // Optimized queries - separate calls to avoid deep nesting
    const [user, userTeams, adminLeagues] = await Promise.all([
      // Get basic user info
      prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, email: true }
      }),
      
      // Get user's teams with optimized includes
      prisma.team.findMany({
        where: {
          user: { email: session.user.email }
        },
        include: {
          league: {
            select: {
              id: true,
              name: true,
              status: true,
              adminId: true,
              _count: { select: { teams: true } }
            }
          },
          _count: { select: { teamPlayers: true } }
        }
      }),
      
      // Get admin leagues separately
      prisma.league.findMany({
        where: {
          admin: { email: session.user.email }
        },
        select: {
          id: true,
          name: true,
          status: true,
          _count: { select: { teams: true } }
        }
      })
    ]);

    if (!user) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    // Check for active rounds efficiently
    const leagueIds = [...userTeams.map(t => t.league.id), ...adminLeagues.map(l => l.id)];
    const activeRounds = leagueIds.length > 0 ? await prisma.auctionRound.findMany({
      where: {
        leagueId: { in: leagueIds },
        status: { not: "COMPLETED" }
      },
      select: { leagueId: true }
    }) : [];
    
    const activeRoundLeagueIds = new Set(activeRounds.map(r => r.leagueId));

    // Prepare response data with optimized structure
    const userLeagues = userTeams.map((team) => ({
      id: team.league.id,
      name: team.league.name,
      status: team.league.status,
      isAdmin: team.league.adminId === user.id,
      teamName: team.name,
      remainingCredits: team.remainingCredits,
      playersCount: team._count.teamPlayers,
      totalTeams: team.league._count.teams,
      hasActiveRound: activeRoundLeagueIds.has(team.league.id),
    }));

    const adminLeaguesFormatted = adminLeagues.map((league) => ({
      id: league.id,
      name: league.name,
      status: league.status,
      totalTeams: league._count.teams,
      hasActiveRound: activeRoundLeagueIds.has(league.id),
    }));

    // Combina le leghe (rimuove duplicati se l'utente è sia giocatore che admin)
    const allLeagues = [...userLeagues];
    adminLeaguesFormatted.forEach((adminLeague) => {
      if (!userLeagues.find((ul) => ul.id === adminLeague.id)) {
        allLeagues.push({
          ...adminLeague,
          isAdmin: true,
          teamName: "",
          remainingCredits: 0,
          playersCount: 0,
        });
      }
    });

    const activeAuctions = allLeagues.filter((league) => league.status === "AUCTION");

    // Get position breakdowns for teams that need them
    const detailedPositionCounts = userTeams.length > 0 ? await prisma.$queryRaw<Array<{
      teamId: string;
      position: string;
      count: number;
    }>>`
      SELECT tp."teamId", p.position, COUNT(*)::int as count
      FROM "TeamPlayer" tp
      JOIN "Player" p ON tp."playerId" = p.id
      WHERE tp."teamId" = ANY(${userTeams.map(t => t.id)})
      GROUP BY tp."teamId", p.position
    ` : [];

    // Prepare detailed team data with optimized queries
    const myTeams = userTeams.map((team) => {
      const teamPositions = detailedPositionCounts.filter(pc => pc.teamId === team.id);
      const getPositionCount = (position: string) => 
        teamPositions.find(pc => pc.position === position)?.count || 0;
      
      const totalPlayers = team._count.teamPlayers;
      
      return {
        id: team.id,
        name: team.name,
        leagueId: team.league.id,
        leagueName: team.league.name,
        remainingCredits: team.remainingCredits,
        playersCount: totalPlayers,
        totalPlayers: 25, // 3P + 8D + 8C + 6A
        leagueStatus: team.league.status,
        isComplete: totalPlayers === 25,
        players: {
          P: getPositionCount('P'),
          D: getPositionCount('D'),
          C: getPositionCount('C'),
          A: getPositionCount('A'),
        }
      };
    });

    return NextResponse.json({
      leagues: allLeagues,
      activeAuctions: activeAuctions,
      myTeams: myTeams,
      stats: {
        totalLeagues: allLeagues.length,
        totalTeams: userLeagues.length,
        activeAuctions: activeAuctions.length,
      },
    });
  } catch (error) {
    console.error("Errore nel recupero dati dashboard:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
