import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`
    
    // Check if Socket.io server is available
    const socketHealthy = !!(global as any).io
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        socketio: socketHealthy ? 'healthy' : 'unavailable'
      },
      version: process.env.npm_package_version || '1.0.0'
    }
    
    return NextResponse.json(health, { status: 200 })
  } catch (error) {
    console.error('Health check failed:', error)
    
    const health = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      services: {
        database: 'unhealthy',
        socketio: !!(global as any).io ? 'healthy' : 'unavailable'
      }
    }
    
    return NextResponse.json(health, { status: 503 })
  }
}