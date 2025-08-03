import { useCallback, useEffect, useState } from 'react'
import { useSocketIO } from './useSocketIO'

interface AuctionState {
  currentRound?: {
    id: string
    position: 'P' | 'D' | 'C' | 'A'
    roundNumber: number
    status: 'SELECTION' | 'RESOLUTION' | 'COMPLETED'
    selections: Array<{
      id: string
      user: { id: string; name: string }
      player: {
        id: string
        name: string
        position: 'P' | 'D' | 'C' | 'A'
        realTeam: string
        price: number
      }
      randomNumber?: number
      isWinner: boolean
    }>
  }
  availablePlayers: Array<{
    id: string
    name: string
    position: 'P' | 'D' | 'C' | 'A'
    realTeam: string
    price: number
  }>
  userSelection?: {
    id: string
    player: {
      id: string
      name: string
      position: 'P' | 'D' | 'C' | 'A'
      realTeam: string
      price: number
    }
    randomNumber?: number
    isWinner: boolean
  }
  hasActiveRound: boolean
}

interface PlayerSelectedData {
  selection: {
    id: string
    user: { id: string; name: string }
    player: {
      id: string
      name: string
      position: 'P' | 'D' | 'C' | 'A'
      realTeam: string
      price: number
    }
  }
  leagueId: string
  roundId: string
}

interface RoundResolvedData {
  leagueId: string
  roundId: string
  result: {
    assignments: Array<{
      teamId: string
      playerId: string
      playerName: string
      teamName: string
      price: number
    }>
    canContinue: boolean
  }
  assignments: Array<{
    teamId: string
    playerId: string
    playerName: string
    teamName: string
    price: number
  }>
  canContinue: boolean
}

interface AuctionStartedData {
  leagueId: string
  currentRound: {
    id: string
    position: 'P' | 'D' | 'C' | 'A'
    roundNumber: number
    status: 'SELECTION' | 'RESOLUTION' | 'COMPLETED'
  }
  league: {
    id: string
    name: string
    status: string
  }
}

interface NextRoundStartedData {
  leagueId: string
  round: {
    id: string
    position: 'P' | 'D' | 'C' | 'A'
    roundNumber: number
    status: 'SELECTION' | 'RESOLUTION' | 'COMPLETED'
  }
  position: string
  message: string
}

interface RoundReadyData {
  leagueId: string
  roundId: string
  message: string
}

interface UseAuctionRealtimeProps {
  leagueId: string
  userId?: string
  userName?: string
  initialState?: AuctionState | null
  onPlayerSelected?: (data: PlayerSelectedData) => void
  onRoundResolved?: (data: RoundResolvedData) => void
  onAuctionStarted?: (data: AuctionStartedData) => void
  onNextRoundStarted?: (data: NextRoundStartedData) => void
  onRoundReadyForResolution?: (data: RoundReadyData) => void
  onUserJoined?: (user: { id: string; name: string }) => void
  onUserLeft?: (user: { id: string; name: string }) => void
  onUserDisconnected?: (user: { id: string; name: string; reason: string }) => void
  onUserTimeout?: (user: { id: string; name: string }) => void
}

export function useAuctionRealtime({
  leagueId,
  userId,
  userName,
  initialState = null,
  onPlayerSelected,
  onRoundResolved,
  onAuctionStarted,
  onNextRoundStarted,
  onRoundReadyForResolution,
  onUserJoined,
  onUserLeft,
  onUserDisconnected,
  onUserTimeout
}: UseAuctionRealtimeProps) {
  const [auctionState, setAuctionState] = useState<AuctionState | null>(initialState)
  const [connectedUsers, setConnectedUsers] = useState<Array<{ id: string; name: string }>>([])
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isSyncing, setIsSyncing] = useState(false)

  const { socket, isConnected, on, off } = useSocketIO({ leagueId, userId, userName, enabled: !!leagueId })

  // Fetch latest auction state
  const refreshAuctionState = useCallback(async () => {
    if (isSyncing) return // Avoid concurrent refreshes
    
    try {
      setIsSyncing(true)
      const response = await fetch(`/api/auction?leagueId=${leagueId}`)
      const data = await response.json()
      
      if (response.ok) {
        setAuctionState(data)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Error refreshing auction state:', error)
    } finally {
      setIsSyncing(false)
    }
  }, [leagueId, isSyncing])

  // Socket event handlers
  useEffect(() => {
    if (!socket || !isConnected) return

    // Player selection event
    const handlePlayerSelected = (data: PlayerSelectedData) => {
      console.log('Player selected:', data)
      refreshAuctionState()
      onPlayerSelected?.(data)
    }

    // Round ready for resolution
    const handleRoundReadyForResolution = (data: RoundReadyData) => {
      console.log('Round ready for resolution:', data)
      refreshAuctionState()
      onRoundReadyForResolution?.(data)
    }

    // Round resolved event
    const handleRoundResolved = (data: RoundResolvedData) => {
      console.log('Round resolved:', data)
      refreshAuctionState()
      onRoundResolved?.(data)
    }

    // Auction started event
    const handleAuctionStarted = (data: AuctionStartedData) => {
      console.log('Auction started:', data)
      refreshAuctionState()
      onAuctionStarted?.(data)
    }

    // Next round started event
    const handleNextRoundStarted = (data: NextRoundStartedData) => {
      console.log('Next round started:', data)
      refreshAuctionState()
      onNextRoundStarted?.(data)
    }

    // User joined/left events
    const handleUserJoined = (user: { id: string; name: string }) => {
      console.log('User joined:', user)
      setConnectedUsers(prev => [...prev.filter(u => u.id !== user.id), user])
      onUserJoined?.(user)
    }

    const handleUserLeft = (user: { id: string; name: string }) => {
      console.log('User left:', user)
      setConnectedUsers(prev => prev.filter(u => u.id !== user.id))
      onUserLeft?.(user)
    }

    const handleUserDisconnected = (user: { id: string; name: string; reason: string }) => {
      console.log('User disconnected:', user, 'Reason:', user.reason)
      setConnectedUsers(prev => prev.filter(u => u.id !== user.id))
      onUserDisconnected?.(user)
    }

    const handleUserTimeout = (user: { id: string; name: string }) => {
      console.log('User timed out:', user)
      setConnectedUsers(prev => prev.filter(u => u.id !== user.id))
      onUserTimeout?.(user)
    }

    const handleUsersOnline = (users: Array<{ id: string; name: string }>) => {
      console.log('Users online:', users)
      setConnectedUsers(users)
    }

    // Register event listeners
    on('player-selected', handlePlayerSelected)
    on('round-ready-for-resolution', handleRoundReadyForResolution)
    on('round-resolved', handleRoundResolved)
    on('auction-started', handleAuctionStarted)
    on('next-round-started', handleNextRoundStarted)
    on('user-joined', handleUserJoined)
    on('user-left', handleUserLeft)
    on('user-disconnected', handleUserDisconnected)
    on('user-timeout', handleUserTimeout)
    on('users-online', handleUsersOnline)

    // Cleanup event listeners on unmount
    return () => {
      off('player-selected', handlePlayerSelected)
      off('round-ready-for-resolution', handleRoundReadyForResolution)
      off('round-resolved', handleRoundResolved)
      off('auction-started', handleAuctionStarted)
      off('next-round-started', handleNextRoundStarted)
      off('user-joined', handleUserJoined)
      off('user-left', handleUserLeft)
      off('user-disconnected', handleUserDisconnected)
      off('user-timeout', handleUserTimeout)
      off('users-online', handleUsersOnline)
    }
  }, [socket, isConnected, on, off, refreshAuctionState, onPlayerSelected, onRoundResolved, onAuctionStarted, onNextRoundStarted, onRoundReadyForResolution, onUserJoined, onUserLeft, onUserDisconnected, onUserTimeout])

  // Initialize state if not provided
  useEffect(() => {
    if (!initialState && isConnected) {
      refreshAuctionState()
    }
  }, [initialState, isConnected, refreshAuctionState])

  // Heartbeat and periodic sync when Socket.io is disconnected
  useEffect(() => {
    if (!leagueId) return

    let heartbeatInterval: NodeJS.Timeout

    if (!isConnected) {
      // Fallback polling when Socket.io is disconnected
      console.log('Socket.io disconnected, falling back to polling')
      heartbeatInterval = setInterval(() => {
        if (!isSyncing) {
          refreshAuctionState()
        }
      }, 5000) // Poll every 5 seconds when disconnected
    } else {
      // When connected, sync periodically but less frequently
      heartbeatInterval = setInterval(() => {
        if (!isSyncing) {
          refreshAuctionState()
        }
      }, 30000) // Sync every 30 seconds to stay in sync
    }

    return () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
      }
    }
  }, [isConnected, leagueId, refreshAuctionState, isSyncing])

  // Sync when coming back online (page visibility change)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isConnected && !isSyncing) {
        console.log('Page became visible, syncing auction state')
        refreshAuctionState()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isConnected, refreshAuctionState, isSyncing])

  return {
    auctionState,
    connectedUsers,
    lastUpdated,
    isConnected,
    isSyncing,
    refreshAuctionState,
    socket
  }
}