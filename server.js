const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize Socket.io
  const io = new Server(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  })

  // Store user sessions
  const userSessions = new Map() // socketId -> { userId, userName, leagueId, lastSeen }

  // Socket.io connection handling
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

    // Join auction room with user authentication
    socket.on('join-auction', (data) => {
      const { leagueId, userId, userName } = data
      
      socket.join(`auction-${leagueId}`)
      console.log(`Socket ${socket.id} (${userName}) joined auction room: auction-${leagueId}`)
      
      // Store user session
      userSessions.set(socket.id, {
        userId,
        userName: userName || 'User',
        leagueId,
        lastSeen: new Date()
      })
      
      // Notifica altri utenti che qualcuno si è unito
      socket.to(`auction-${leagueId}`).emit('user-joined', {
        id: userId,
        name: userName || 'User',
        socketId: socket.id
      })

      // Send current online users to the new connection
      const onlineUsers = Array.from(userSessions.values())
        .filter(session => session.leagueId === leagueId && session.userId !== userId)
        .map(session => ({ id: session.userId, name: session.userName }))
      
      socket.emit('users-online', onlineUsers)
    })

    // Leave auction room
    socket.on('leave-auction', (leagueId) => {
      const userSession = userSessions.get(socket.id)
      
      socket.leave(`auction-${leagueId}`)
      console.log(`Socket ${socket.id} left auction room: auction-${leagueId}`)
      
      if (userSession) {
        // Notifica altri utenti che qualcuno è uscito
        socket.to(`auction-${leagueId}`).emit('user-left', {
          id: userSession.userId,
          name: userSession.userName,
          socketId: socket.id
        })
        
        userSessions.delete(socket.id)
      }
    })

    // Heartbeat to track active connections
    socket.on('heartbeat', () => {
      const userSession = userSessions.get(socket.id)
      if (userSession) {
        userSession.lastSeen = new Date()
      }
    })

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log('Client disconnected:', socket.id, 'Reason:', reason)
      
      const userSession = userSessions.get(socket.id)
      if (userSession) {
        const { leagueId, userId, userName } = userSession
        
        // Notifica altri utenti della disconnessione
        socket.to(`auction-${leagueId}`).emit('user-disconnected', {
          id: userId,
          name: userName,
          socketId: socket.id,
          reason
        })
        
        userSessions.delete(socket.id)
      }
    })

    // Handle connection errors
    socket.on('error', (error) => {
      console.error('Socket error:', socket.id, error)
    })
  })

  // Clean up inactive sessions every 5 minutes
  setInterval(() => {
    const now = new Date()
    const timeoutMs = 5 * 60 * 1000 // 5 minutes
    
    for (const [socketId, session] of userSessions.entries()) {
      if (now - session.lastSeen > timeoutMs) {
        console.log(`Cleaning up inactive session: ${socketId} (${session.userName})`)
        
        // Notify others of timeout
        io.to(`auction-${session.leagueId}`).emit('user-timeout', {
          id: session.userId,
          name: session.userName,
          socketId
        })
        
        userSessions.delete(socketId)
      }
    }
  }, 60000) // Check every minute

  // Store io instance globally for use in API routes
  global.io = io

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})