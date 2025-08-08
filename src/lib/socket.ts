import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'

export interface AuctionJoinData {
  leagueId: string
  userId?: string
  userName?: string
}

export interface AuctionEvents {
  // Eventi dal client
  'join-auction': (data: AuctionJoinData) => void
  'leave-auction': (leagueId: string) => void
  
  // Eventi dal server
  'auction-state-changed': (auctionState: unknown) => void
  'player-selected': (selection: unknown) => void
  'round-resolved': (roundResult: unknown) => void
  'auction-started': (auctionState: unknown) => void
  'next-round-started': (auctionState: unknown) => void
  'user-joined': (user: { id: string; name: string }) => void
  'user-left': (user: { id: string; name: string }) => void
  'team-joined': (data: { leagueId: string; teamName: string; userName: string; teamCount: number }) => void
  'league-updated': (data: { leagueId: string; teamCount: number }) => void
  'league-created': (data: { leagueId: string; leagueName: string; adminName: string; teamCount: number }) => void
  'bot-config-updated': (data: { leagueId: string; isEnabled: boolean; botCount: number; intelligence: string }) => void
}

export function initializeSocketIO(server: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // Join leagues room (for general league updates)
    socket.on('join-leagues', () => {
      socket.join('leagues')
      console.log(`Socket ${socket.id} joined leagues room`)
    })

    // Leave leagues room
    socket.on('leave-leagues', () => {
      socket.leave('leagues')
      console.log(`Socket ${socket.id} left leagues room`)
    })

    // Join auction room
    socket.on('join-auction', (leagueId: string) => {
      socket.join(`auction-${leagueId}`)
      console.log(`Socket ${socket.id} joined auction room: auction-${leagueId}`)
      
      // Notifica altri utenti che qualcuno si è unito
      socket.to(`auction-${leagueId}`).emit('user-joined', {
        id: socket.id,
        name: 'User' // In seguito aggiungeremo il nome reale dall'auth
      })
    })

    // Leave auction room
    socket.on('leave-auction', (leagueId: string) => {
      socket.leave(`auction-${leagueId}`)
      console.log(`Socket ${socket.id} left auction room: auction-${leagueId}`)
      
      // Notifica altri utenti che qualcuno è uscito
      socket.to(`auction-${leagueId}`).emit('user-left', {
        id: socket.id,
        name: 'User'
      })
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  return io
}

// Helper per emettere eventi all'auction room
export function emitToAuctionRoom(io: SocketIOServer, leagueId: string, event: keyof AuctionEvents, data: unknown) {
  io.to(`auction-${leagueId}`).emit(event, data)
}