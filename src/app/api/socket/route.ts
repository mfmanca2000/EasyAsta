export async function GET() {
  // For Socket.io with App Router, we need to handle this differently
  // Socket.io will be initialized in the middleware or through a custom server
  return new Response('Socket.io endpoint - use WebSocket connection', { status: 200 })
}