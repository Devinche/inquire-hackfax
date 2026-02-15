"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { AssessmentFlow } from "@/components/neuro-screen/assessment-flow"
import { Button } from "@/components/ui/button"

export default function Page() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div>
      <div className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-lg border border-border bg-card/95 px-4 py-2 shadow-lg backdrop-blur-sm">
        <span className="text-sm text-muted-foreground">{user.email}</span>
        <Button variant="outline" size="sm" onClick={logout}>
          Logout
        </Button>
      </div>
      <AssessmentFlow />
    </div>
  )
}
