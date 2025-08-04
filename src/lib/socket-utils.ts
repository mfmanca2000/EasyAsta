import { Server } from 'socket.io'

// Global Socket.io instance types
interface GlobalSocket {
  io?: Server
}

declare const globalThis: GlobalSocket & typeof global
declare const global: GlobalSocket

/**
 * Get the global Socket.io instance
 * Checks both globalThis.io and global.io for compatibility
 */
export function getSocketIO(): Server | null {
  const io = globalThis.io || global.io
  return io || null
}

/**
 * Emit an event to a specific auction room
 */
export function emitToAuctionRoom(leagueId: string, event: string, data: Record<string, unknown>): boolean {
  const io = getSocketIO()
  if (!io) {
    console.error(`[SOCKET] Cannot emit ${event} - Socket.io not available`)
    return false
  }
  
  const roomName = `auction-${leagueId}`
  console.log(`[SOCKET] Emitting ${event} to room ${roomName}`)
  io.to(roomName).emit(event, data)
  return true
}