import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { createAccessToken, createRefreshToken, setAuthCookies } from "@/lib/auth"
import { eq, and } from "drizzle-orm"

export async function POST(request: NextRequest) {
  try {
    const { email, password, role, adminCode } = await request.json()

    // Validate input
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Email, password, and role are required" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    if (role !== "patient" && role !== "admin") {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      )
    }

    // Validate admin code if registering as admin
    if (role === "admin") {
      const validAdminCode = process.env.ADMIN_CODE || "sclosh"
      if (!adminCode || adminCode !== validAdminCode) {
        return NextResponse.json(
          { error: "Invalid admin code" },
          { status: 403 }
        )
      }
    }

    // Check if user with this email and role already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.role, role)))
      .limit(1)

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: `${role === "admin" ? "Admin" : "Patient"} account with this email already exists` },
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
        role,
      })
      .returning()

    // Create tokens
    const accessToken = await createAccessToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    })

    const refreshToken = await createRefreshToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    })

    // Set cookies
    await setAuthCookies(accessToken, refreshToken)

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
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
