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

/**
 * Emit an event to a specific user
 */
export function emitToUser(userId: string, event: string, data: Record<string, unknown>): boolean {
  const io = getSocketIO()
  if (!io) {
    console.error(`[SOCKET] Cannot emit ${event} - Socket.io not available`)
    return false
  }
  
  const roomName = `user-${userId}`
  console.log(`[SOCKET] Emitting ${event} to user room ${roomName}`)
  io.to(roomName).emit(event, data)
  return true
}

/**
 * Emit different events to a specific user vs all other users in auction room
 */
export function emitPlayerSelectionPrivacy(
  leagueId: string, 
  selectingUserId: string,
  event: string,
  fullData: Record<string, unknown>, 
  anonymousData: Record<string, unknown>
): boolean {
  const io = getSocketIO()
  if (!io) {
    console.error(`[SOCKET] Cannot emit ${event} - Socket.io not available`)
    return false
  }

  // Send full details to the selecting user
  console.log(`[SOCKET] Emitting ${event} with full details to user-${selectingUserId}`)
  io.to(`user-${selectingUserId}`).emit(event, fullData)
  
  // Send anonymous details to other users in the auction room
  console.log(`[SOCKET] Emitting ${event} with anonymous details to auction-${leagueId} (excluding user-${selectingUserId})`)
  io.to(`auction-${leagueId}`).except(`user-${selectingUserId}`).emit(event, anonymousData)
  
  return true
}

/**
 * Emit an event to the general leagues room
 */
export function emitToLeaguesRoom(event: string, data: Record<string, unknown>): boolean {
  const io = getSocketIO()
  if (!io) {
    console.error(`[SOCKET] Cannot emit ${event} - Socket.io not available`)
    return false
  }
  
  io.to('leagues').emit(event, data)
  return true
}