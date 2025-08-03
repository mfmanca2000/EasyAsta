import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

async function processSelections(round: any) {
  // Raggruppa selezioni per calciatore
  const playerSelections = new Map<string, typeof round.selections>();

  round.selections.forEach((selection: any) => {
    const playerId = selection.playerId;
    if (!playerSelections.has(playerId)) {
      playerSelections.set(playerId, []);
    }
    playerSelections.get(playerId)!.push(selection);
  });

  const assignments: Array<{
    playerId: string;
    winnerId: string;
    winnerName: string;
    playerName: string;
    price: number;
    randomNumber?: number;
  }> = [];

  const conflicts: Array<{
    playerId: string;
    playerName: string;
    price: number;
    conflicts: Array<{
      teamId: string;
      teamName: string;
      userName: string;
      randomNumber: number;
      isWinner: boolean;
    }>;
  }> = [];

  const teamsWithAssignments = new Set<string>();

  // Get all teams data once to avoid repeated queries
  const allTeams = await prisma.team.findMany({
    where: { leagueId: round.leagueId },
  });
  const teamsMap = new Map(allTeams.map((team) => [team.userId, team]));

  // Process each group of selections
  for (const [, selections] of playerSelections) {
    if (selections.length === 1) {
      // No conflict - direct assignment
      const selection = selections[0];
      const team = teamsMap.get(selection.userId);

      if (team && team.remainingCredits >= selection.player.price) {
        assignments.push({
          playerId: selection.playerId,
          winnerId: selection.userId,
          winnerName: selection.user.name || "Sconosciuto",
          playerName: selection.player.name,
          price: selection.player.price,
        });
        teamsWithAssignments.add(team.id);
      }
    } else {
      // Conflict - generate random numbers
      const validSelections = selections.filter((selection: any) => {
        const team = teamsMap.get(selection.userId);
        return team && team.remainingCredits >= selection.player.price;
      });

      if (validSelections.length > 0) {
        // Generate random numbers for valid selections
        const randomResults = validSelections.map((selection: any) => ({
          selection,
          team: teamsMap.get(selection.userId)!,
          randomNumber: Math.floor(Math.random() * 1000) + 1,
        }));

        // Sort by random number (highest wins)
        randomResults.sort((a: { randomNumber: number }, b: { randomNumber: number }) => b.randomNumber - a.randomNumber);
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
          conflicts: randomResults.map((result: any) => ({
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

export async function resolveRound(roundId: string) {
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
export async function createNextRound(leagueId: string, position: "P" | "D" | "C" | "A") {
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
