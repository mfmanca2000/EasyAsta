"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConnectionStatus } from "@/components/auction/ConnectionStatus";
import { useAuctionPusher } from "@/hooks/useAuctionPusher";
import { 
  enableFallbackMode, 
  attemptReconnection, 
  getConnectionStatus 
} from "@/lib/pusher-client";
import { RefreshCw, AlertCircle, CheckCircle } from "lucide-react";

export default function TestFallbackPage() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunningTest, setIsRunningTest] = useState(false);

  // Mock auction hook for testing
  const auctionHook = useAuctionPusher({
    leagueId: "test-league-123",
    onPlayerSelected: (data) => {
      addTestResult(`Player selected: ${data.playerName} by ${data.teamName}`);
    },
    onRoundResolved: (data) => {
      addTestResult(`Round resolved: ${data.roundId}`);
    },
    onAuctionStarted: (data) => {
      addTestResult(`Auction started: ${data.status}`);
    },
  });

  const addTestResult = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const runFallbackTest = async () => {
    setIsRunningTest(true);
    setTestResults([]);

    try {
      addTestResult("🧪 Starting fallback test sequence...");

      // Step 1: Show current connection status
      const initialStatus = getConnectionStatus();
      addTestResult(`Initial status: Connected=${initialStatus.isConnected}, Fallback=${initialStatus.fallbackMode}`);

      // Step 2: Force enable fallback mode
      addTestResult("🔄 Enabling fallback mode manually...");
      enableFallbackMode();
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      const fallbackStatus = getConnectionStatus();
      addTestResult(`After fallback: Connected=${fallbackStatus.isConnected}, Fallback=${fallbackStatus.fallbackMode}`);

      // Step 3: Wait and observe polling behavior
      addTestResult("⏱️ Observing polling behavior (10 seconds)...");
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Step 4: Attempt reconnection
      addTestResult("🔄 Attempting to reconnect to Pusher...");
      const reconnectSuccess = await attemptReconnection();
      
      if (reconnectSuccess) {
        addTestResult("✅ Reconnection successful!");
      } else {
        addTestResult("❌ Reconnection failed - staying in fallback mode");
      }

      const finalStatus = getConnectionStatus();
      addTestResult(`Final status: Connected=${finalStatus.isConnected}, Fallback=${finalStatus.fallbackMode}`);

      addTestResult("🎉 Test sequence completed!");

    } catch (error) {
      addTestResult(`❌ Test error: ${error}`);
    } finally {
      setIsRunningTest(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Fallback System Test</h1>
        <p className="text-muted-foreground mt-2">
          Test the automatic fallback from Pusher to polling mode
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Status */}
        <ConnectionStatus
          isConnected={auctionHook.isConnected}
          fallbackMode={auctionHook.fallbackMode}
          isPolling={auctionHook.isPolling}
          isSyncing={auctionHook.isSyncing}
          connectionStatus={auctionHook.connectionStatus}
          onRefresh={auctionHook.refreshAuctionState}
        />

        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Test Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button
                onClick={runFallbackTest}
                disabled={isRunningTest}
                className="w-full"
              >
                {isRunningTest && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                {isRunningTest ? "Running Test..." : "Run Fallback Test"}
              </Button>
              
              <p className="text-xs text-muted-foreground">
                This will simulate a Pusher failure and test automatic fallback to polling mode.
              </p>
            </div>

            {/* Current Status */}
            <div className="space-y-2">
              <h4 className="font-medium">Current Status:</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant={auctionHook.isConnected ? "default" : "secondary"}>
                  {auctionHook.isConnected ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Disconnected
                    </>
                  )}
                </Badge>
                
                {auctionHook.fallbackMode && (
                  <Badge variant="destructive">
                    Fallback Mode
                  </Badge>
                )}
                
                {auctionHook.isPolling && (
                  <Badge variant="outline">
                    Polling Active
                  </Badge>
                )}
                
                {auctionHook.isSyncing && (
                  <Badge variant="secondary">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Syncing
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Test Results
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTestResults([])}
              disabled={testResults.length === 0}
            >
              Clear
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {testResults.length === 0 ? (
            <p className="text-muted-foreground italic">No test results yet. Run the fallback test to see results.</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className="text-sm font-mono p-2 rounded bg-muted/50"
                >
                  {result}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information */}
      <Card>
        <CardHeader>
          <CardTitle>How the Fallback System Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-green-700">✅ Pusher Mode (Default)</h4>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Real-time updates via WebSocket</li>
                <li>• Instant notifications</li>
                <li>• Low bandwidth usage</li>
                <li>• Best user experience</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-orange-700">⚠️ Polling Mode (Fallback)</h4>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Updates every 2 seconds</li>
                <li>• Automatic when quota reached</li>
                <li>• Seamless transition</li>
                <li>• Application continues working</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">Automatic Triggers for Fallback Mode:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Pusher daily quota limit reached (most common)</li>
              <li>• Connection failures (3+ consecutive failures)</li>
              <li>• Network connectivity issues</li>
              <li>• Pusher service unavailable</li>
              <li>• Manual testing (development mode only)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}