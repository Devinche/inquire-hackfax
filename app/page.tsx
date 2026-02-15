"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { AssessmentFlow } from "@/components/neuro-screen/assessment-flow"
import { ConsoleFilter } from "@/components/console-filter"

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
    <>
      <ConsoleFilter />
      <AssessmentFlow userEmail={user.email} userRole={user.role} onLogout={logout} />
    </>
  )
}
