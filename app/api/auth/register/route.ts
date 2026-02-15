import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
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

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await hash(password, 12)

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
      })
      .returning()

    // Create tokens
    const accessToken = await createAccessToken({
      userId: newUser.id,
      email: newUser.email,
    })

    const refreshToken = await createRefreshToken({
      userId: newUser.id,
      email: newUser.email,
    })

    // Set cookies
    await setAuthCookies(accessToken, refreshToken)

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    )
  }
}
