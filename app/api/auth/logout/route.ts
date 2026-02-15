import { NextResponse } from "next/server"
import { clearAuthCookies } from "@/lib/auth"

export async function POST() {
  try {
    await clearAuthCookies()

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    )
  }
}
