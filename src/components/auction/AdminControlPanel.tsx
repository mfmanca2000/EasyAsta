'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { 
  Clock, 
  Settings, 
  UserCheck, 
  AlertTriangle,
  Shield,
  Eye
} from 'lucide-react'

interface AdminControlPanelProps {
  leagueId: string
  currentRound?: {
    id: string
    position: string
    status: string
    roundNumber: number
  }
  teams: Array<{
    id: string
    name: string
    userId: string
    remainingCredits: number
    user: {
      id: string
      name?: string
      email: string
    }
  }>
  availablePlayers: Array<{
    id: string
    name: string
    position: string
    realTeam: string
    price: number
  }>
  selections: Array<{
    id: string
    userId: string
    playerId: string
    isAdminSelection?: boolean
    adminReason?: string
    user: {
      id: string
      name?: string
    }
    player: {
      id: string
      name: string
      position: string
      realTeam: string
      price: number
    }
    randomNumber?: number
    isWinner: boolean
  }>
  config?: {
    timeoutSeconds: number
    autoSelectOnTimeout: boolean
    pauseOnDisconnect: boolean
  }
}

interface AdminAction {
  type: 'admin-select' | 'cancel-selection' | 'force-resolution' | 'reset-round' | 'timeout-config'
  data: {
    roundId?: string
    playerId?: string
    targetTeamId?: string
    reason?: string
    timeoutSeconds?: number
    autoSelectOnTimeout?: boolean
    pauseOnDisconnect?: boolean
  }
}

export default function AdminControlPanel({
  leagueId,
  currentRound,
  teams,
  availablePlayers,
  selections,
  config
}: AdminControlPanelProps) {
  const t = useTranslations('auction')
  const [activeTab, setActiveTab] = useState<'select' | 'override' | 'config' | 'audit'>('select')
  const [loading, setLoading] = useState(false)
  
  // Admin Selection State
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [adminReason, setAdminReason] = useState('')
  
  // Override State
  const [overrideAction, setOverrideAction] = useState<'cancel-selection' | 'force-resolution' | 'reset-round'>('cancel-selection')
  const [overrideTeam, setOverrideTeam] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  
  // Config State
  const [timeoutSeconds, setTimeoutSeconds] = useState(config?.timeoutSeconds || 30)
  const [autoSelectOnTimeout, setAutoSelectOnTimeout] = useState<boolean>(config?.autoSelectOnTimeout ?? true)
  const [pauseOnDisconnect, setPauseOnDisconnect] = useState<boolean>(config?.pauseOnDisconnect ?? false)

  const executeAdminAction = async (action: AdminAction) => {
    setLoading(true)
    try {
      let response: Response
      
      switch (action.type) {
        case 'admin-select':
          response = await fetch('/api/auction/admin-select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.data)
          })
          break
          
        case 'cancel-selection':
        case 'force-resolution':  
        case 'reset-round':
          response = await fetch('/api/auction/admin-override', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roundId: currentRound?.id,
              action: action.type.replace('-', '-'),
              ...action.data
            })
          })
          break
          
        case 'timeout-config':
          response = await fetch('/api/auction/timeout-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leagueId, ...action.data })
          })
          break
          
        default:
          throw new Error('Unknown action type')
      }
      
      if (!response?.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }
      
      const result = await response.json()
      toast.success(result.message || t('admin.actionSuccess'))
      
      // Reset form states
      setSelectedTeam('')
      setSelectedPlayer('')
      setAdminReason('')
      setOverrideTeam('')
      setOverrideReason('')
      
    } catch (error: unknown) {
      console.error('Admin action error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(errorMessage || t('admin.actionError'))
    } finally {
      setLoading(false)
    }
  }

  const handleAdminSelect = () => {
    if (!selectedTeam || !selectedPlayer) {
      toast.error(t('admin.selectTeamAndPlayer'))
      return
    }
    
    executeAdminAction({
      type: 'admin-select',
      data: {
        roundId: currentRound?.id,
        playerId: selectedPlayer,
        targetTeamId: selectedTeam,
        reason: adminReason || t('admin.defaultReason')
      }
    })
  }

  const handleOverride = () => {
    if (!overrideReason.trim()) {
      toast.error(t('admin.reasonRequired'))
      return
    }
    
    const actionData: { reason: string; targetTeamId?: string } = { reason: overrideReason }
    if (overrideAction === 'cancel-selection' && !overrideTeam) {
      toast.error(t('admin.selectTeamToCancel'))
      return
    }
    if (overrideAction === 'cancel-selection') {
      actionData.targetTeamId = overrideTeam
    }
    
    executeAdminAction({
      type: overrideAction,
      data: actionData
    })
  }

  const handleConfigUpdate = () => {
    executeAdminAction({
      type: 'timeout-config',
      data: {
        timeoutSeconds,
        autoSelectOnTimeout,
        pauseOnDisconnect
      }
    })
  }

  const teamsWithoutSelection = teams.filter(team => 
    !selections.some(selection => selection.userId === team.userId)
  )

  const teamsWithSelection = teams.filter(team =>
    selections.some(selection => selection.userId === team.userId)
  )

  if (!currentRound) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">
            {t('admin.noActiveRound')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('admin.controlPanel')}
          </CardTitle>
          <CardDescription>
            {t('admin.roundInfo', { 
              round: currentRound.roundNumber,
              position: currentRound.position,
              status: currentRound.status
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {teamsWithSelection.length}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('admin.teamsSelected')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {teamsWithoutSelection.length}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('admin.teamsPending')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {availablePlayers.length}
              </div>
              <div className="text-sm text-muted-foreground">
                {t('admin.playersAvailable')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Control Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: 'select', label: t('admin.tabs.select'), icon: UserCheck },
          { id: 'override', label: t('admin.tabs.override'), icon: AlertTriangle },
          { id: 'config', label: t('admin.tabs.config'), icon: Settings },
          { id: 'audit', label: t('admin.tabs.audit'), icon: Eye }
        ].map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className="flex items-center gap-2"
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Admin Selection Tab */}
      {activeTab === 'select' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.selectForTeam')}</CardTitle>
            <CardDescription>
              {t('admin.selectForTeamDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.selectTeam')}</Label>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.chooseTeam')} />
                  </SelectTrigger>
                  <SelectContent>
                    {teamsWithoutSelection.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{team.name}</span>
                          <Badge variant="outline">
                            {team.remainingCredits} {t('credits')}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>{t('admin.selectPlayer')}</Label>
                <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.choosePlayer')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlayers.map(player => (
                      <SelectItem key={player.id} value={player.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{player.name} ({player.realTeam})</span>
                          <Badge variant="outline">
                            {player.price} {t('credits')}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>{t('admin.reason')}</Label>
              <Textarea
                value={adminReason}
                onChange={(e) => setAdminReason(e.target.value)}
                placeholder={t('admin.reasonPlaceholder')}
                rows={2}
              />
            </div>
            
            <Button 
              onClick={handleAdminSelect}
              disabled={loading || !selectedTeam || !selectedPlayer}
              className="w-full"
            >
              {loading ? t('loading') : t('admin.executeSelection')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Override Controls Tab */}
      {activeTab === 'override' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.overrideControls')}</CardTitle>
            <CardDescription>
              {t('admin.overrideControlsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t('admin.overrideAction')}</Label>
              <Select value={overrideAction} onValueChange={(value: typeof overrideAction) => setOverrideAction(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cancel-selection">
                    {t('admin.actions.cancelSelection')}
                  </SelectItem>
                  <SelectItem value="force-resolution">
                    {t('admin.actions.forceResolution')}
                  </SelectItem>
                  <SelectItem value="reset-round">
                    {t('admin.actions.resetRound')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {overrideAction === 'cancel-selection' && (
              <div>
                <Label>{t('admin.teamToCancel')}</Label>
                <Select value={overrideTeam} onValueChange={setOverrideTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.chooseTeam')} />
                  </SelectTrigger>
                  <SelectContent>
                    {teamsWithSelection.map(team => {
                      const selection = selections.find(s => s.userId === team.userId)
                      return (
                        <SelectItem key={team.id} value={team.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{team.name}</span>
                            {selection && (
                              <Badge variant={selection.isAdminSelection === true ? 'destructive' : 'default'}>
                                {selection.player.name}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <Label>{t('admin.overrideReason')}</Label>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder={t('admin.overrideReasonPlaceholder')}
                rows={2}
                required
              />
            </div>
            
            <Button 
              onClick={handleOverride}
              disabled={loading || !overrideReason.trim()}
              variant="destructive"
              className="w-full"
            >
              {loading ? t('loading') : t('admin.executeOverride')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Configuration Tab */}
      {activeTab === 'config' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('admin.timeoutConfig')}
            </CardTitle>
            <CardDescription>
              {t('admin.timeoutConfigDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t('admin.timeoutSeconds')}</Label>
              <Input
                type="number"
                min="10"
                max="300"
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(parseInt(e.target.value))}
              />
              <p className="text-sm text-muted-foreground mt-1">
                {t('admin.timeoutRange')}
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.autoSelectOnTimeout')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('admin.autoSelectOnTimeoutDesc')}
                </p>
              </div>
              <Switch
                checked={autoSelectOnTimeout}
                onCheckedChange={setAutoSelectOnTimeout}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('admin.pauseOnDisconnect')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('admin.pauseOnDisconnectDesc')}
                </p>
              </div>
              <Switch
                checked={pauseOnDisconnect}
                onCheckedChange={setPauseOnDisconnect}
              />
            </div>
            
            <Button 
              onClick={handleConfigUpdate}
              disabled={loading}
              className="w-full"
            >
              {loading ? t('loading') : t('admin.updateConfig')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Audit Trail Tab */}
      {activeTab === 'audit' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.auditTrail')}</CardTitle>
            <CardDescription>
              {t('admin.auditTrailDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-8">
              {t('admin.auditTrailPlaceholder')}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}