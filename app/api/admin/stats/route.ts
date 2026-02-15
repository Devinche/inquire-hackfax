import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, assessments } from "@/lib/db/schema"
import { sql } from "drizzle-orm"

export async function GET() {
  try {
    // Get counts
    const userCount = await db.select({ count: sql<number>`count(*)` }).from(users)
    const assessmentCount = await db.select({ count: sql<number>`count(*)` }).from(assessments)

    // Get recent users (without passwords)
    const recentUsers = await db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .limit(10)

    // Get recent assessments
    const recentAssessments = await db
      .select()
      .from(assessments)
      .limit(10)

    return NextResponse.json({
      stats: {
        totalUsers: userCount[0].count,
        totalAssessments: assessmentCount[0].count,
      },
      recentUsers,
      recentAssessments,
    })
  } catch (error) {
    console.error("Admin stats error:", error)
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
