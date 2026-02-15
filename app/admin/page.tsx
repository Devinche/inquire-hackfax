"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface Stats {
  totalUsers: number
  totalAssessments: number
}

interface User {
  id: number
  email: string
  createdAt: string
}

interface Assessment {
  id: number
  userId: number
  timestamp: string
  createdAt: string
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      const response = await fetch("/api/admin/stats")
      const data = await response.json()
      setStats(data.stats)
      setUsers(data.recentUsers)
      setAssessments(data.recentAssessments)
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <Link href="/">
            <Button variant="outline">Back to App</Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Total Users
            </h3>
            <p className="text-4xl font-bold">{stats?.totalUsers || 0}</p>
          </Card>
          <Card className="p-6">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Total Assessments
            </h3>
            <p className="text-4xl font-bold">{stats?.totalAssessments || 0}</p>
          </Card>
        </div>

        {/* Recent Users */}
        <Card className="mb-8 p-6">
          <h2 className="mb-4 text-xl font-semibold">Recent Users (Last 5)</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left">ID</th>
                  <th className="pb-2 text-left">Email</th>
                  <th className="pb-2 text-left">Role</th>
                  <th className="pb-2 text-left">Created At</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 5).map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="py-2">{user.id}</td>
                    <td className="py-2">{user.email}</td>
                    <td className="py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        (user as any).role === "admin" 
                          ? "bg-primary/10 text-primary" 
                          : "bg-secondary text-secondary-foreground"
                      }`}>
                        {(user as any).role || "patient"}
                      </span>
                    </td>
                    <td className="py-2">
                      {new Date(user.createdAt).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent Assessments */}
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">Recent Assessments (Last 5)</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left">ID</th>
                  <th className="pb-2 text-left">User ID</th>
                  <th className="pb-2 text-left">Assessment Taken</th>
                </tr>
              </thead>
              <tbody>
                {assessments.slice(0, 5).map((assessment) => (
                  <tr key={assessment.id} className="border-b">
                    <td className="py-2">{assessment.id}</td>
                    <td className="py-2">{assessment.userId}</td>
                    <td className="py-2">
                      {new Date(assessment.timestamp).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
