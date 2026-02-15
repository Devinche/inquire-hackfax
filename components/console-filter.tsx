"use client"

import { useEffect } from "react"

/**
 * Global console filter to suppress MediaPipe WASM info messages.
 * Must run on client side before MediaPipe loads.
 */
export function ConsoleFilter() {
  useEffect(() => {
    // Store original console methods
    const originalError = console.error
    const originalInfo = console.info
    const originalLog = console.log

    // Override console.error to filter MediaPipe messages
    console.error = (...args: unknown[]) => {
      const msg = String(args[0] || "")
      if (
        msg.includes("Created TensorFlow Lite XNNPACK delegate for CPU") ||
        msg.includes("INFO:")
      ) {
        return // Suppress this message
      }
      originalError.apply(console, args)
    }

    // Override console.info
    console.info = (...args: unknown[]) => {
      const msg = String(args[0] || "")
      if (msg.includes("Created TensorFlow Lite XNNPACK delegate for CPU")) {
        return
      }
      originalInfo.apply(console, args)
    }

    // Override console.log
    console.log = (...args: unknown[]) => {
      const msg = String(args[0] || "")
      if (msg.includes("Created TensorFlow Lite XNNPACK delegate for CPU")) {
        return
      }
      originalLog.apply(console, args)
    }

    // Cleanup on unmount (restore originals)
    return () => {
      console.error = originalError
      console.info = originalInfo
      console.log = originalLog
    }
  }, [])

  return null // This component doesn't render anything
}
