import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { assessments } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// POST - Save a new assessment
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { speechData, handData, eyeData, timestamp } = body

    const result = await db.insert(assessments).values({
      userId: session.userId,
      speechData,
      handData,
      eyeData,
      timestamp: new Date(timestamp),
    }).returning()

    return NextResponse.json({
      success: true,
      assessment: result[0],
    })
  } catch (error) {
    console.error("Error saving assessment:", error)
    return NextResponse.json(
      { success: false, error: "Failed to save assessment" },
      { status: 500 }
    )
  }
}

// GET - Retrieve user's assessments
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get user's assessments
    const results = await db
      .select()
      .from(assessments)
      .where(eq(assessments.userId, session.userId))
      .orderBy(desc(assessments.timestamp))

    return NextResponse.json({
      success: true,
      assessments: results,
    })
  } catch (error) {
    console.error("Error retrieving assessments:", error)
    return NextResponse.json(
      { success: false, error: "Failed to retrieve assessments" },
      { status: 500 }
    )
  }
}
