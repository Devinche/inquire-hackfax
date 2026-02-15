import { NextRequest, NextResponse } from "next/server"
import { compare } from "bcryptjs"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { createAccessToken, createRefreshToken, setAuthCookies } from "@/lib/auth"
import { eq } from "drizzle-orm"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // Verify password
    const isValid = await compare(password, user.passwordHash)

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // Create tokens
    const accessToken = await createAccessToken({
      userId: user.id,
      email: user.email,
    })

    const refreshToken = await createRefreshToken({
      userId: user.id,
      email: user.email,
    })

    // Set cookies
    await setAuthCookies(accessToken, refreshToken)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    )
  }
}
