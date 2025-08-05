import { prisma } from "@/lib/prisma";
import { Player, Position, AuctionRound } from "@/types";
import { Prisma } from "@prisma/client";

// Local interfaces for auction logic
// interface User {
//   id: string;
//   name?: string | null;
//   email: string;
// }

interface Team {
  id: string;
  name: string;
  userId: string;
  leagueId: string;
  remainingCredits: number;
}

interface League {
  id: string;
  name: string;
  adminId: string;
  credits: number;
  status: string;
}

// Using centralized PlayerSelection and AuctionRound from @/types
// Local extension for database query results
interface LocalPlayerSelection {
  id: string;
  roundId: string;
  userId: string;
  playerId: string;
  randomNumber: number | null;
  isWinner: boolean;
  isAdminSelection: boolean;
  adminReason: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    role: any; // UserRole enum
    isBot: boolean;
    createdAt: Date;
    updatedAt: Date;
    emailVerified: Date | null;
  };
  player: Player;
}

interface LocalAuctionRound extends AuctionRound {
  league: League;
  selections: LocalPlayerSelection[];
}

interface Assignment {
  playerId: string;
  winnerId: string;
  winnerName: string;
  playerName: string;
  price: number;
  randomNumber?: number;
}

interface ConflictResult {
  teamId: string;
  teamName: string;
  userName: string;
  randomNumber: number;
  isWinner: boolean;
}

interface Conflict {
  playerId: string;
  playerName: string;
  price: number;
  conflicts: ConflictResult[];
}

interface RandomResult {
  selection: LocalPlayerSelection;
  team: Team;
  randomNumber: number;
}

interface ProcessSelectionsResult {
  assignments: Assignment[];
  conflicts: Conflict[];
  teamsWithAssignments: Set<string>;
  allTeams: Team[];
}

interface ResolveRoundResult {
  completedRound: LocalAuctionRound;
  assignments: Assignment[];
  conflicts: Conflict[];
  roundContinues: boolean;
  canContinue: boolean;
  teamsWithoutAssignments: Array<{ id: string; name: string }>;
  message: string;
}

async function processSelections(round: LocalAuctionRound): Promise<ProcessSelectionsResult> {
  // Raggruppa selezioni per calciatore
  const playerSelections = new Map<string, LocalPlayerSelection[]>();

  round.selections.forEach((selection: LocalPlayerSelection) => {
    const playerId = selection.playerId;
    if (!playerSelections.has(playerId)) {
      playerSelections.set(playerId, []);
    }
    playerSelections.get(playerId)!.push(selection);
  });

  const assignments: Assignment[] = [];
  const conflicts: Conflict[] = [];

  const teamsWithAssignments = new Set<string>();

  // Get all teams data with their current players once to avoid repeated queries
  const allTeams = await prisma.team.findMany({
    where: { leagueId: round.leagueId },
    include: {
      teamPlayers: {
        include: {
          player: true,
        },
      },
    },
  });
  const teamsMap = new Map(allTeams.map((team) => [team.userId, team]));

  // Helper function to check if team can add a player of specific position
  const canTeamAddPosition = (team: { teamPlayers: Array<{ player: { position: Position } }> }, position: Position): boolean => {
    const positionCounts = { P: 0, D: 0, C: 0, A: 0 };
    team.teamPlayers.forEach((tp: { player: { position: Position } }) => {
      positionCounts[tp.player.position as keyof typeof positionCounts]++;
    });

    const maxByPosition = { P: 3, D: 8, C: 8, A: 6 };
    return positionCounts[position] < maxByPosition[position];
  };

  // Process each group of selections
  for (const [, selections] of playerSelections) {
    if (selections.length === 1) {
      // No conflict - direct assignment
      const selection = selections[0];
      const team = teamsMap.get(selection.userId);

      if (team && selection.player && team.remainingCredits >= selection.player.price && canTeamAddPosition(team, selection.player.position as Position)) {
        assignments.push({
          playerId: selection.playerId,
          winnerId: selection.userId,
          winnerName: selection.user?.name || "Sconosciuto",
          playerName: selection.player!.name,
          price: selection.player!.price,
        });
        teamsWithAssignments.add(team.id);
      }
    } else {
      // Conflict - generate random numbers
      const validSelections = selections.filter((selection) => {
        const team = teamsMap.get(selection.userId);
        return team && team.remainingCredits >= selection.player.price && canTeamAddPosition(team, selection.player.position as Position);
      });

      if (validSelections.length > 0) {
        // Generate random numbers for valid selections
        const randomResults: RandomResult[] = validSelections.map((selection) => ({
          selection,
          team: teamsMap.get(selection.userId)!,
          randomNumber: Math.floor(Math.random() * 1000) + 1,
        }));

        // Sort by random number (highest wins)
        randomResults.sort((a, b) => b.randomNumber - a.randomNumber);
        const winner = randomResults[0];

        assignments.push({
          playerId: winner.selection.playerId,
          winnerId: winner.selection.userId,
          winnerName: winner.selection.user.name || "Sconosciuto",
          playerName: winner.selection.player.name,
          price: winner.selection.player.price,
          randomNumber: winner.randomNumber,
        });

        teamsWithAssignments.add(winner.team.id);

        // Track conflict for modal
        conflicts.push({
          playerId: winner.selection.playerId,
          playerName: winner.selection.player.name,
          price: winner.selection.player.price,
          conflicts: randomResults.map((result) => ({
            teamId: result.team.id,
            teamName: result.team.name,
            userName: result.selection.user.name || result.selection.user.email || "Sconosciuto",
            randomNumber: result.randomNumber,
            isWinner: result === winner,
          })),
        });
      }
    }
  }

  return { assignments, conflicts, teamsWithAssignments, allTeams };
}

export async function resolveRound(roundId: string): Promise<ResolveRoundResult> {
  // Get round data outside of transaction
  const round = await prisma.auctionRound.findFirst({
    where: { id: roundId },
    include: {
      league: true,
      selections: {
        include: {
          user: true,
          player: true,
        },
      },
    },
  });

  if (!round) {
    throw new Error("Turno non trovato");
  }

  // Process selections outside transaction
  const { assignments, conflicts, teamsWithAssignments, allTeams } = await processSelections(round);

  // Now perform database updates in a shorter, more focused transaction
  return await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // Apply all the assignments to the database
      for (const assignment of assignments) {
        const team = allTeams.find((t) => t.userId === assignment.winnerId);
        if (!team) continue;

        // Check if player is already assigned to this team
        const existingAssignment = await tx.teamPlayer.findUnique({
          where: {
            teamId_playerId: {
              teamId: team.id,
              playerId: assignment.playerId,
            },
          },
        });

        if (!existingAssignment) {
          // Assign player
          await tx.teamPlayer.create({
            data: {
              teamId: team.id,
              playerId: assignment.playerId,
            },
          });

          // Update team credits
          await tx.team.update({
            where: { id: team.id },
            data: {
              remainingCredits: team.remainingCredits - assignment.price,
            },
          });

          // Mark player as assigned
          await tx.player.update({
            where: { id: assignment.playerId },
            data: { isAssigned: true },
          });
        }
      }

      // Update selections with results
      for (const selection of round.selections) {
        const assignment = assignments.find((a) => a.playerId === selection.playerId && a.winnerId === selection.userId);
        const conflict = conflicts.find((c) => c.playerId === selection.playerId);

        if (assignment || conflict) {
          const conflictResult = conflict?.conflicts.find((c) => c.teamId === allTeams.find((t) => t.userId === selection.userId)?.id);

          await tx.playerSelection.update({
            where: { id: selection.id },
            data: {
              isWinner: !!assignment,
              randomNumber: assignment?.randomNumber || conflictResult?.randomNumber,
            },
          });
        }
      }

      // Check if round continues or completes
      const teamsWithoutAssignments = allTeams.filter((team) => !teamsWithAssignments.has(team.id));
      const roundContinues = teamsWithoutAssignments.length > 0 && conflicts.length > 0;

      if (roundContinues) {
        // Remove selections from teams that lost conflicts
        await tx.playerSelection.deleteMany({
          where: {
            roundId,
            user: {
              teams: {
                some: {
                  id: { notIn: Array.from(teamsWithAssignments) },
                },
              },
            },
          },
        });

        // Round continues in SELECTION state
        await tx.auctionRound.update({
          where: { id: roundId },
          data: { status: "SELECTION" },
        });
      } else {
        // Complete the round
        await tx.auctionRound.update({
          where: { id: roundId },
          data: { status: "COMPLETED" },
        });
      }

      // Check if auction can continue (only if round is completed)
      const canContinue = roundContinues ? false : await checkIfAuctionCanContinue(tx, round.leagueId);

      return {
        completedRound: round,
        assignments,
        conflicts,
        roundContinues,
        canContinue,
        teamsWithoutAssignments: teamsWithoutAssignments.map((t) => ({
          id: t.id,
          name: t.name,
        })),
        message: roundContinues
          ? `${assignments.length} calciatori assegnati. Il turno continua con ${teamsWithoutAssignments.length} squadre.`
          : `Turno completato! ${assignments.length} calciatori assegnati.`,
      };
    },
    {
      timeout: 30000, // 30 second timeout for the transaction
    }
  );
}

async function checkIfAuctionCanContinue(tx: Prisma.TransactionClient, leagueId: string) {
  // Controlla se tutte le rose sono complete
  const teams = await tx.team.findMany({
    where: { leagueId },
    include: {
      teamPlayers: {
        include: {
          player: true,
        },
      },
    },
  });

  // Definisci il numero massimo per ruolo
  const maxByPosition = { P: 3, D: 8, C: 8, A: 6 };

  // Controlla se tutte le squadre hanno la rosa completa
  const allRostersComplete = teams.every((team) => {
    const composition = { P: 0, D: 0, C: 0, A: 0 };
    team.teamPlayers.forEach((tp) => {
      composition[tp.player.position as keyof typeof composition]++;
    });

    return composition.P === maxByPosition.P && composition.D === maxByPosition.D && composition.C === maxByPosition.C && composition.A === maxByPosition.A;
  });

  if (allRostersComplete) {
    // Asta completata
    await tx.league.update({
      where: { id: leagueId },
      data: { status: "COMPLETED" },
    });
    return false;
  }

  return true;
}

// Nuova funzione per creare il prossimo turno scelto dall'admin
export async function createNextRound(leagueId: string, position: Position) {
  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Verifica che non ci sia già un turno attivo
    const activeRound = await tx.auctionRound.findFirst({
      where: {
        leagueId,
        status: {
          in: ["SELECTION", "RESOLUTION"],
        },
      },
    });

    if (activeRound) {
      throw new Error("Esiste già un turno attivo");
    }

    // Ottieni il numero del prossimo turno globale (non per posizione)
    const lastRound = await tx.auctionRound.findFirst({
      where: {
        leagueId,
      },
      orderBy: {
        roundNumber: "desc",
      },
    });

    const nextRoundNumber = lastRound ? lastRound.roundNumber + 1 : 1;

    // Crea il nuovo turno
    const newRound = await tx.auctionRound.create({
      data: {
        leagueId,
        position,
        roundNumber: nextRoundNumber,
        status: "SELECTION",
      },
    });

    return newRound;
  });
}
