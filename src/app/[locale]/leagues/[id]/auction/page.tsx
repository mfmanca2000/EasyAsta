'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Users, Clock, Trophy, Coins } from 'lucide-react'

interface Player {
  id: string
  name: string
  position: 'P' | 'D' | 'C' | 'A'
  realTeam: string
  price: number
}

interface AuctionRound {
  id: string
  position: 'P' | 'D' | 'C' | 'A'
  roundNumber: number
  status: 'SELECTION' | 'RESOLUTION' | 'COMPLETED'
  selections: Array<{
    id: string
    user: { id: string; name: string }
    player: Player
    randomNumber?: number
    isWinner: boolean
  }>
}

interface AuctionState {
  currentRound?: AuctionRound
  availablePlayers: Player[]
  userSelection?: {
    id: string
    player: Player
    randomNumber?: number
    isWinner: boolean
  }
  hasActiveRound: boolean
}

interface NextRoundStats {
  teamStats: Array<{
    teamName: string
    userName: string
    composition: { P: number; D: number; C: number; A: number }
    needs: { P: number; D: number; C: number; A: number }
  }>
  globalNeeds: { P: number; D: number; C: number; A: number }
  availableByPosition: { P: number; D: number; C: number; A: number }
  recommendations: { P: boolean; D: boolean; C: boolean; A: boolean }
}

const positionNames = {
  P: 'Portieri',
  D: 'Difensori', 
  C: 'Centrocampisti',
  A: 'Attaccanti'
}

export default function AuctionPage() {
  const params = useParams()
  const { data: session } = useSession()
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [polling, setPolling] = useState(false)
  const [nextRoundStats, setNextRoundStats] = useState<NextRoundStats | null>(null)
  const [showNextRoundModal, setShowNextRoundModal] = useState(false)
  const [teamCount, setTeamCount] = useState(0)

  const leagueId = params.id as string

  const fetchAuctionState = useCallback(async () => {
    try {
      const response = await fetch(`/api/auction?leagueId=${leagueId}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Errore nel caricamento')
      }

      setAuctionState(data)
      setError(null)
    } catch (error) {
      console.error('Errore fetch stato asta:', error)
      setError(error instanceof Error ? error.message : 'Errore sconosciuto')
    }
  }, [leagueId])

  const checkIfAdmin = useCallback(async () => {
    try {
      const response = await fetch(`/api/leagues/${leagueId}`)
      const data = await response.json()
      
      if (response.ok && data.league) {
        setIsAdmin(data.league.admin.email === session?.user?.email)
        setTeamCount(data.league.teams?.length || 0)
      }
    } catch (error) {
      console.error('Errore verifica admin:', error)
    }
  }, [leagueId, session?.user?.email])

  useEffect(() => {
    if (session && leagueId) {
      checkIfAdmin()
      fetchAuctionState().finally(() => setLoading(false))
    }
  }, [session, leagueId, checkIfAdmin, fetchAuctionState])

  // Polling per aggiornamenti real-time (sarà sostituito da Socket.io)
  useEffect(() => {
    if (!auctionState?.hasActiveRound) return

    const interval = setInterval(() => {
      if (!polling) {
        setPolling(true)
        fetchAuctionState().finally(() => setPolling(false))
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [auctionState?.hasActiveRound, polling, fetchAuctionState])

  const startAuction = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Errore avvio asta')
      }

      await fetchAuctionState()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore avvio asta')
    } finally {
      setLoading(false)
    }
  }

  const selectPlayer = async (playerId: string) => {
    if (!auctionState?.currentRound || isSelecting) return

    try {
      setIsSelecting(true)
      const response = await fetch('/api/auction/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: auctionState.currentRound.id,
          playerId
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Errore selezione')
      }

      await fetchAuctionState()
      setSelectedPlayer(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore selezione')
    } finally {
      setIsSelecting(false)
    }
  }

  const resolveRound = async () => {
    if (!auctionState?.currentRound) return

    try {
      setLoading(true)
      const response = await fetch('/api/auction/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: auctionState.currentRound.id
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Errore risoluzione')
      }

      await fetchAuctionState()
      
      // Se l'asta può continuare, mostra il modal per scegliere il prossimo ruolo
      if (data.canContinue) {
        await fetchNextRoundStats()
        setShowNextRoundModal(true)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore risoluzione')
    } finally {
      setLoading(false)
    }
  }

  const fetchNextRoundStats = async () => {
    try {
      const response = await fetch(`/api/auction/next-round?leagueId=${leagueId}`)
      const data = await response.json()
      
      if (response.ok) {
        setNextRoundStats(data)
      }
    } catch (error) {
      console.error('Errore caricamento statistiche:', error)
    }
  }

  const startNextRound = async (position: 'P' | 'D' | 'C' | 'A') => {
    try {
      setLoading(true)
      const response = await fetch('/api/auction/next-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          position
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Errore avvio turno')
      }

      setShowNextRoundModal(false)
      await fetchAuctionState()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore avvio turno')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()}>
          Ricarica pagina
        </Button>
      </div>
    )
  }

  if (!auctionState?.hasActiveRound) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Asta Fantacalcio
            </CardTitle>
            <CardDescription>
              {auctionState ? 'Nessun turno attivo' : 'L&apos;asta non è ancora iniziata'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isAdmin ? (
              <div className="space-y-4">
                {!auctionState ? (
                  <>
                    {teamCount < 4 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          <strong>Squadre insufficienti:</strong> Servono almeno 4 squadre per avviare l'asta. 
                          Attualmente: {teamCount}/4 squadre.
                        </p>
                      </div>
                    )}
                    <Button 
                      onClick={startAuction} 
                      disabled={loading || teamCount < 4}
                    >
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Avvia Asta
                    </Button>
                  </>
                ) : (
                  <>
                    {teamCount < 4 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          <strong>Squadre insufficienti:</strong> Servono almeno 4 squadre per continuare l'asta. 
                          Attualmente: {teamCount}/4 squadre.
                        </p>
                      </div>
                    )}
                    <p className="text-muted-foreground mb-4">
                      Turno completato. Scegli il ruolo per il prossimo turno:
                    </p>
                    <Button 
                      onClick={async () => {
                        await fetchNextRoundStats()
                        setShowNextRoundModal(true)
                      }} 
                      disabled={loading || teamCount < 4}
                    >
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Avvia Prossimo Turno
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">
                Aspetta che l&apos;admin {auctionState ? 'avvii il prossimo turno' : 'avvii l&apos;asta'}...
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const { currentRound, availablePlayers, userSelection } = auctionState

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Asta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Asta Fantacalcio - {positionNames[currentRound!.position]}
            </div>
            <Badge variant={currentRound!.status === 'SELECTION' ? 'default' : 'secondary'}>
              {currentRound!.status === 'SELECTION' ? 'Selezione' : 'Risoluzione'}
            </Badge>
          </CardTitle>
          <CardDescription className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Turno {currentRound!.roundNumber}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {currentRound!.selections.length} selezioni
            </span>
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Stato Utente */}
      {userSelection ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-green-600">
              ✓ Hai selezionato: {userSelection.player.name}
            </CardTitle>
            <CardDescription>
              {userSelection.randomNumber ? 
                `Numero casuale: ${userSelection.randomNumber} ${userSelection.isWinner ? '🏆' : ''}` :
                'In attesa degli altri giocatori...'
              }
            </CardDescription>
          </CardHeader>
        </Card>
      ) : currentRound!.status === 'SELECTION' ? (
        <Card>
          <CardHeader>
            <CardTitle>Seleziona un calciatore</CardTitle>
            <CardDescription>
              Scegli un {positionNames[currentRound!.position].toLowerCase()} dalla lista
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availablePlayers.map((player) => (
                <Card 
                  key={player.id} 
                  className={`cursor-pointer transition-colors ${
                    selectedPlayer === player.id ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedPlayer(player.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{player.name}</h3>
                      <Badge variant="outline">{player.position}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {player.realTeam}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-sm font-medium">
                        <Coins className="w-3 h-3" />
                        {player.price}
                      </span>
                      {selectedPlayer === player.id && (
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation()
                            selectPlayer(player.id)
                          }}
                          disabled={isSelecting}
                        >
                          {isSelecting && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                          Seleziona
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Selezioni Attuali */}
      {currentRound!.selections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Selezioni Turno</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {currentRound!.selections.map((selection) => (
                <div 
                  key={selection.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <span className="font-medium">{selection.user.name}</span>
                    <span className="mx-2">→</span>
                    <span>{selection.player.name}</span>
                    <span className="text-muted-foreground ml-2">
                      ({selection.player.realTeam})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      {selection.player.price}
                    </span>
                    {selection.randomNumber && (
                      <Badge variant={selection.isWinner ? 'default' : 'secondary'}>
                        {selection.randomNumber} {selection.isWinner && '🏆'}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controlli Admin */}
      {isAdmin && currentRound!.status === 'RESOLUTION' && (
        <Card>
          <CardHeader>
            <CardTitle>Controlli Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={resolveRound} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Risolvi Turno
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modal Scelta Prossimo Ruolo */}
      <Dialog open={showNextRoundModal} onOpenChange={setShowNextRoundModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Scegli il prossimo ruolo</DialogTitle>
            <DialogDescription>
              Seleziona quale ruolo far scegliere nel prossimo turno d&apos;asta
            </DialogDescription>
          </DialogHeader>
          
          {nextRoundStats && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {(['P', 'D', 'C', 'A'] as const).map((position) => {
                  const positionName = positionNames[position]
                  const isRecommended = nextRoundStats.recommendations[position]
                  
                  return (
                    <Card key={position} className={`cursor-pointer transition-colors ${isRecommended ? 'ring-2 ring-green-500' : ''}`}>
                      <CardContent className="p-4 text-center">
                        <div className="space-y-2">
                          <Badge variant={isRecommended ? 'default' : 'outline'}>
                            {position}
                          </Badge>
                          <h3 className="font-medium text-sm">{positionName}</h3>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>Necessari: {nextRoundStats.globalNeeds[position]}</div>
                            <div>Disponibili: {nextRoundStats.availableByPosition[position]}</div>
                          </div>
                          <Button 
                            size="sm" 
                            variant={isRecommended ? 'default' : 'outline'}
                            disabled={!isRecommended || loading}
                            onClick={() => startNextRound(position)}
                            className="w-full"
                          >
                            {loading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                            Avvia Turno
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              
              {/* Dettaglio squadre */}
              <div className="mt-6">
                <h4 className="font-medium mb-3">Situazione squadre:</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {nextRoundStats.teamStats.map((team, index: number) => (
                    <div key={index} className="flex items-center justify-between text-sm p-2 border rounded">
                      <span className="font-medium">{team.teamName}</span>
                      <div className="flex gap-2 text-xs">
                        {(['P', 'D', 'C', 'A'] as const).map(pos => (
                          <span key={pos} className={team.needs[pos] > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                            {pos}: {team.composition[pos]}/{pos === 'P' ? 3 : pos === 'A' ? 6 : 8}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}