"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  const { data: session } = useSession()

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-primary mb-4">
          EasyAsta
        </h1>
        <p className="text-xl text-muted-foreground">
          Gestione professionale delle aste del fantacalcio
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🏆 Sistema Asta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Turni automatici per ruolo, selezioni simultanee e risoluzione conflitti con numeri casuali
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⚡ Real-time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Aggiornamenti in tempo reale per tutti i partecipanti con Socket.io
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              👥 Multi-squadra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Supporto per leghe da 4 a 8 squadre con gestione automatica dei crediti
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {session ? (
        <div className="text-center">
          <p className="text-lg mb-6">
            Benvenuto, <span className="font-semibold">{session.user?.name}</span>!
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg">
                Vai alla Dashboard
              </Button>
            </Link>
            {session.user?.role === "ADMIN" && (
              <Link href="/admin">
                <Button variant="outline" size="lg">
                  Pannello Admin
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Inizia Subito</CardTitle>
            <CardDescription>
              Accedi con il tuo account Google per creare o partecipare alle aste
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              • Crea nuove leghe fantacalcio<br />
              • Partecipa alle aste esistenti<br />
              • Gestisci la tua rosa<br />
              • Import calciatori da Excel
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
