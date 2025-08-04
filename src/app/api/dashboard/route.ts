import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401 }
      );
    }

    // Recupera l'utente dal database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        teams: {
          include: {
            league: {
              include: {
                admin: true,
                teams: {
                  include: {
                    user: true
                  }
                },
                rounds: {
                  orderBy: { createdAt: 'desc' },
                  take: 1
                }
              }
            },
            teamPlayers: {
              include: {
                player: true
              }
            }
          }
        },
        adminLeagues: {
          include: {
            teams: {
              include: {
                user: true
              }
            },
            rounds: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utente non trovato" },
        { status: 404 }
      );
    }

    // Prepara i dati della risposta
    const userLeagues = user.teams.map(team => ({
      id: team.league.id,
      name: team.league.name,
      status: team.league.status,
      isAdmin: team.league.adminId === user.id,
      teamName: team.name,
      remainingCredits: team.remainingCredits,
      playersCount: team.teamPlayers.length,
      totalTeams: team.league.teams.length,
      hasActiveRound: team.league.rounds.length > 0 && team.league.rounds[0].status !== 'COMPLETED'
    }));

    const adminLeagues = user.adminLeagues.map(league => ({
      id: league.id,
      name: league.name,
      status: league.status,
      totalTeams: league.teams.length,
      hasActiveRound: league.rounds.length > 0 && league.rounds[0].status !== 'COMPLETED'
    }));

    // Combina le leghe (rimuove duplicati se l'utente è sia giocatore che admin)
    const allLeagues = [...userLeagues];
    adminLeagues.forEach(adminLeague => {
      if (!userLeagues.find(ul => ul.id === adminLeague.id)) {
        allLeagues.push({
          ...adminLeague,
          isAdmin: true,
          teamName: null,
          remainingCredits: null,
          playersCount: 0
        });
      }
    });

    const activeAuctions = allLeagues.filter(league => 
      league.status === 'AUCTION'
    );

    return NextResponse.json({
      leagues: allLeagues,
      activeAuctions: activeAuctions,
      stats: {
        totalLeagues: allLeagues.length,
        totalTeams: userLeagues.length,
        activeAuctions: activeAuctions.length
      }
    });

  } catch (error) {
    console.error("Errore nel recupero dati dashboard:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}