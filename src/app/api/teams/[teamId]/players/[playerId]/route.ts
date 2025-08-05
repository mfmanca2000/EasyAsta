import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; playerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { teamId, playerId } = await params;

    // Trova l'utente nel database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    // Trova la squadra con la lega
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        league: {
          select: {
            id: true,
            adminId: true,
            status: true,
          },
        },
        teamPlayers: {
          where: { playerId },
          include: {
            player: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Squadra non trovata" }, { status: 404 });
    }

    // Solo l'admin può rimuovere calciatori dalle squadre
    if (team.league.adminId !== user.id) {
      return NextResponse.json({ error: "Solo l'admin può rimuovere calciatori dalle squadre" }, { status: 403 });
    }

    // Verifica che il calciatore sia effettivamente nella squadra
    const teamPlayer = team.teamPlayers[0];
    if (!teamPlayer) {
      return NextResponse.json({ error: "Calciatore non presente nella squadra" }, { status: 404 });
    }

    // Usa una transazione per rimuovere il calciatore e aggiornare i crediti
    const result = await prisma.$transaction(async (tx) => {
      // Rimuovi l'assegnazione del calciatore
      await tx.teamPlayer.delete({
        where: {
          teamId_playerId: {
            teamId,
            playerId,
          },
        },
      });

      // Aggiorna lo stato del calciatore come non assegnato
      await tx.player.update({
        where: { id: playerId },
        data: { isAssigned: false },
      });

      // Restituisci i crediti alla squadra
      const updatedTeam = await tx.team.update({
        where: { id: teamId },
        data: {
          remainingCredits: {
            increment: teamPlayer.player.price,
          },
        },
      });

      return { updatedTeam, removedPlayer: teamPlayer.player };
    });

    return NextResponse.json({ 
      message: "Calciatore rimosso dalla squadra con successo",
      team: result.updatedTeam,
      player: result.removedPlayer,
    });

  } catch (error) {
    console.error("Errore rimozione calciatore dalla squadra:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}