"use client"

import { useSession } from "next-auth/react"
import { redirect } from "@/i18n/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function Dashboard() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <div className="text-center">Caricamento...</div>
  }

  if (!session) {
    redirect("/")
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Benvenuto, {session.user?.name}
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Le Mie Leghe</CardTitle>
            <CardDescription>
              Leghe a cui partecipi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Nessuna lega trovata
            </p>
            <Button variant="outline" className="w-full">
              Unisciti a una Lega
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Le Mie Squadre</CardTitle>
            <CardDescription>
              Gestisci le tue rose
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Nessuna squadra trovata
            </p>
            <Button variant="outline" className="w-full">
              Visualizza Rose
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aste Attive</CardTitle>
            <CardDescription>
              Partecipa alle aste in corso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Nessuna asta attiva
            </p>
            <Button variant="outline" className="w-full">
              Cerca Aste
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Prossimi Passi</CardTitle>
            <CardDescription>
              Inizia subito a usare EasyAsta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-sm">Unisciti a una lega esistente o creane una nuova</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-muted rounded-full"></div>
                <span className="text-sm">Configura la tua squadra</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-muted rounded-full"></div>
                <span className="text-sm">Partecipa alle aste</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}