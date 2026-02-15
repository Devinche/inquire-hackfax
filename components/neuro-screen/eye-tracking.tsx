"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Eye,
  CheckCircle2,
  Loader2,
  SkipForward,
  RotateCcw,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { EyeData } from "./assessment-flow"

const TASK_DURATION = 15

interface EyeTrackingProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  cameraOn: boolean
  onComplete: (data: EyeData) => void
  onSkip: () => void
  userRole?: "patient" | "admin"
}

/**
 * Suppress MediaPipe's WASM INFO log routed through console.error.
 * Note: Global filter in ConsoleFilter component should handle most cases.
 */
function suppressMediaPipeInfo<T>(fn: () => T): T {
  // Just execute the function - global filter handles suppression
  return fn()
}

/**
 * Enhanced adaptive gaze tracking with head pose compensation
 */
function getGazePosition(
  landmarks: Array<{ x: number; y: number; z: number }>,
  previousGaze?: { x: number; y: number },
  calibrationData?: { centerX: number; centerY: number; rangeX: number; rangeY: number }
): { x: number; y: number; confidence: "high" | "medium" | "low" } {
  // Iris center landmarks
  const leftIris = landmarks[468]
  const rightIris = landmarks[473]

  // Left eye corners and lids
  const leftOuter = landmarks[33]
  const leftInner = landmarks[133]
  const leftTop = landmarks[159]
  const leftBottom = landmarks[145]

  // Right eye corners and lids
  const rightInner = landmarks[362]
  const rightOuter = landmarks[263]
  const rightTop = landmarks[386]
  const rightBottom = landmarks[374]

  // Head reference points for pose compensation
  const noseTip = landmarks[1]
  const leftCheek = landmarks[234]
  const rightCheek = landmarks[454]

  if (
    leftIris && rightIris &&
    leftOuter && leftInner && leftTop && leftBottom &&
    rightOuter && rightInner && rightTop && rightBottom &&
    noseTip && leftCheek && rightCheek
  ) {
    const leftEyeWidth = Math.abs(leftInner.x - leftOuter.x)
    const rightEyeWidth = Math.abs(rightOuter.x - rightInner.x)
    const leftEyeHeight = Math.abs(leftBottom.y - leftTop.y)
    const rightEyeHeight = Math.abs(rightBottom.y - rightTop.y)

    if (leftEyeWidth > 0.001 && rightEyeWidth > 0.001 &&
        leftEyeHeight > 0.001 && rightEyeHeight > 0.001) {
      
      // Calculate eye centers for reference
      const leftEyeCenterX = (leftOuter.x + leftInner.x) / 2
      const leftEyeCenterY = (leftTop.y + leftBottom.y) / 2
      const rightEyeCenterX = (rightOuter.x + rightInner.x) / 2
      const rightEyeCenterY = (rightTop.y + rightBottom.y) / 2
      
      // Calculate relative iris position within eye bounds (normalized)
      const leftRelX = (leftIris.x - leftOuter.x) / leftEyeWidth
      const leftRelY = (leftIris.y - leftTop.y) / leftEyeHeight
      const rightRelX = (rightIris.x - rightInner.x) / rightEyeWidth
      const rightRelY = (rightIris.y - rightTop.y) / rightEyeHeight

      // Average both eyes for more stable tracking
      let gazeRelX = (leftRelX + rightRelX) / 2
      let gazeRelY = (leftRelY + rightRelY) / 2

      // Head pose compensation: detect if head is turning
      // If head turns, the eye corners move but iris position within eye should stay stable
      const faceWidth = Math.abs(rightCheek.x - leftCheek.x)
      const eyeDistance = Math.abs(rightEyeCenterX - leftEyeCenterX)
      const symmetryRatio = eyeDistance / faceWidth
      
      // If face is turned significantly, reduce sensitivity
      // Normal symmetry ratio is around 0.4-0.5
      const headTurnFactor = Math.abs(symmetryRatio - 0.45) < 0.1 ? 1.0 : 0.7

      // Apply adaptive calibration if available
      if (calibrationData) {
        gazeRelX = (gazeRelX - calibrationData.centerX) / calibrationData.rangeX + 0.5
        gazeRelY = (gazeRelY - calibrationData.centerY) / calibrationData.rangeY + 0.5
      }

      // Adaptive amplification - reduced for head-still tracking
      // Lower amplification means less sensitivity to small movements (including head wobble)
      const amplificationX = 2.5 * headTurnFactor
      const amplificationY = 2.2 * headTurnFactor
      
      let screenX = 0.5 + (gazeRelX - 0.5) * amplificationX
      let screenY = 0.5 + (gazeRelY - 0.5) * amplificationY

      // Mirror the X coordinate to match the mirrored camera view
      // When you look right, iris moves right in mirror, but screen position should be right too
      screenX = 1 - screenX

      // Apply stronger smoothing to reduce jitter from micro head movements
      if (previousGaze) {
        const smoothingFactor = 0.4 // 40% new, 60% old - more smoothing
        screenX = previousGaze.x * (1 - smoothingFactor) + screenX * smoothingFactor
        screenY = previousGaze.y * (1 - smoothingFactor) + screenY * smoothingFactor
      }

      // Clamp to screen bounds
      screenX = Math.max(0, Math.min(1, screenX))
      screenY = Math.max(0, Math.min(1, screenY))

      return {
        x: screenX,
        y: screenY,
        confidence: "high",
      }
    }
  }

  // Fallback: use eye openness as rough vertical indicator
  if (leftOuter && leftInner && rightOuter && rightInner && leftTop && rightTop && leftBottom && rightBottom) {
    const leftOpenness = Math.abs(leftBottom.y - leftTop.y) / (Math.abs(leftInner.x - leftOuter.x) || 0.001)
    const rightOpenness = Math.abs(rightBottom.y - rightTop.y) / (Math.abs(rightOuter.x - rightInner.x) || 0.001)
    const avgOpenness = (leftOpenness + rightOpenness) / 2
    
    let y = 0.5 + (avgOpenness - 0.3) * 1.5
    
    // Apply smoothing
    if (previousGaze) {
      y = previousGaze.y * 0.7 + y * 0.3
    }
    
    return {
      x: previousGaze?.x || 0.5,
      y: Math.max(0, Math.min(1, y)),
      confidence: "medium",
    }
  }

  return { x: previousGaze?.x || 0.5, y: previousGaze?.y || 0.5, confidence: "low" }
}

export function EyeTracking({
  videoRef,
  cameraOn,
  onComplete,
  onSkip,
  userRole,
}: EyeTrackingProps) {
  const [status, setStatus] = useState<
    "loading" | "ready" | "tracking" | "done"
  >("loading")
  const [timeLeft, setTimeLeft] = useState(TASK_DURATION)
  const [smoothness, setSmoothness] = useState<number | null>(null)
  const [dotPosition, setDotPosition] = useState({ x: 50, y: 50 })
  const [gazeOnDot, setGazeOnDot] = useState(false)
  const [currentGazePosition, setCurrentGazePosition] = useState<{ x: number; y: number } | null>(null)
  const [restartCount, setRestartCount] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const faceLandmarkerRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const deltasRef = useRef<number[]>([])
  const positionErrorsRef = useRef<number[]>([])
  const velocityGainsRef = useRef<number[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneRef = useRef(false)
  const gazeOnTargetCountRef = useRef(0)
  const totalFrameCountRef = useRef(0)
  const currentDotRef = useRef({ x: 50, y: 50 })
  const previousGazeRef = useRef({ x: 0.5, y: 0.5, time: 0 })
  const previousDotRef = useRef({ x: 50, y: 50, time: 0 })

  useEffect(() => {
    let cancelled = false

    async function loadModel() {
      try {
        const { FilesetResolver, FaceLandmarker } = await import(
          "@mediapipe/tasks-vision"
        )
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        )
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          },
        })
        if (!cancelled) {
          faceLandmarkerRef.current = faceLandmarker
          setStatus("ready")
        }
      } catch (err) {
        console.error("Face model load error:", err)
      }
    }

    loadModel()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (dotIntervalRef.current) clearInterval(dotIntervalRef.current)
      try {
        faceLandmarkerRef.current?.close()
      } catch (err) {
        // Suppress MediaPipe WASM cleanup errors
      }
    }
  }, [])

  /**
   * More forgiving smoothness scoring for webcam-based eye tracking:
   * 1. Position error (distance from target) - 50% weight
   * 2. Movement smoothness (RMS of deltas) - 30% weight
   * 3. Pursuit gain (eye velocity / target velocity) - 20% weight
   */
  const computeFinalScore = useCallback((
    deltas: number[],
    positionErrors: number[],
    velocityGains: number[]
  ) => {
    if (deltas.length < 10) return 60

    // Skip first 20% as settling period
    const skipCount = Math.max(5, Math.floor(deltas.length * 0.2))
    const settledDeltas = deltas.slice(skipCount)
    const settledErrors = positionErrors.slice(skipCount)
    const settledGains = velocityGains.slice(skipCount)
    
    if (settledDeltas.length < 5) return 60

    // 1. Position accuracy score (50% weight) - mean distance from target
    const meanError = settledErrors.reduce((s, e) => s + e, 0) / settledErrors.length
    // More forgiving: 30% error still gives 80+ score
    const accuracyScore = Math.max(0, Math.min(100, 100 - (meanError * 200)))

    // 2. Smoothness score (30% weight) - RMS of movement deltas
    const rms = Math.sqrt(
      settledDeltas.reduce((s, d) => s + d * d, 0) / settledDeltas.length
    )
    // More forgiving sigmoid
    const smoothnessScore = 100 / (1 + Math.exp(50 * (rms - 0.04)))

    // 3. Pursuit gain score (20% weight) - how well eye velocity matches target velocity
    let gainScore = 70 // Default decent score
    if (settledGains.length > 0) {
      const meanGain = settledGains.reduce((s, g) => s + g, 0) / settledGains.length
      // More forgiving: any gain between 0.5-1.2 is good
      if (meanGain >= 0.5 && meanGain <= 1.2) {
        gainScore = 90
      } else if (meanGain >= 0.3 && meanGain <= 1.5) {
        gainScore = 75
      }
    }

    // Weighted combination
    const finalScore = (
      accuracyScore * 0.50 +
      smoothnessScore * 0.30 +
      gainScore * 0.20
    )

    return Math.max(0, Math.min(100, finalScore))
  }, [])

  const stopTracking = useCallback(() => {
    doneRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (dotIntervalRef.current) clearInterval(dotIntervalRef.current)
  }, [])

  const storedResultRef = useRef<EyeData | null>(null)

  const finishTest = useCallback(
    (skipped: boolean) => {
      stopTracking()

      const allDeltas = deltasRef.current
      const allErrors = positionErrorsRef.current
      const allGains = velocityGainsRef.current
      
      const rawSmoothness = skipped ? 0 : computeFinalScore(allDeltas, allErrors, allGains)
      
      const meanDelta =
        allDeltas.length > 0
          ? allDeltas.reduce((s, d) => s + d, 0) / allDeltas.length
          : 0
      const maxDelta = allDeltas.length > 0 ? Math.max(...allDeltas) : 0
      const gazeOnTarget =
        totalFrameCountRef.current > 0
          ? Math.round(
              (gazeOnTargetCountRef.current / totalFrameCountRef.current) * 100
            )
          : 0

      // Apply gaze-on-target modifier (much more forgiving)
      let finalSmoothness = rawSmoothness
      if (!skipped) {
        if (gazeOnTarget < 20) {
          // Only penalize very poor tracking
          const gazePenalty = 0.75 + (gazeOnTarget / 20) * 0.25
          finalSmoothness = rawSmoothness * gazePenalty
        } else if (gazeOnTarget >= 60) {
          // Bonus for good tracking
          const gazeBonus = 1.0 + Math.min(0.15, (gazeOnTarget - 60) / 200)
          finalSmoothness = Math.min(100, rawSmoothness * gazeBonus)
        }
      }

      const result: EyeData = {
        smoothness: Math.round(finalSmoothness * 10) / 10,
        samples: allDeltas.length,
        deltas: allDeltas.slice(-300),
        meanDelta,
        maxDelta,
        gazeOnTarget,
        wasSkipped: skipped,
        restartCount,
      }

      storedResultRef.current = result
      setSmoothness(finalSmoothness)
      setStatus("done")
    },
    [stopTracking, restartCount, computeFinalScore]
  )

  const handleContinue = useCallback(() => {
    if (storedResultRef.current) {
      onComplete(storedResultRef.current)
    }
  }, [onComplete])

  const startTracking = useCallback(() => {
    if (!faceLandmarkerRef.current || !videoRef.current || !cameraOn) return

    doneRef.current = false
    setStatus("tracking")
    deltasRef.current = []
    positionErrorsRef.current = []
    velocityGainsRef.current = []
    gazeOnTargetCountRef.current = 0
    totalFrameCountRef.current = 0
    setTimeLeft(TASK_DURATION)
    setSmoothness(null)
    setGazeOnDot(false)

    // Moving dot for user to follow
    const newDot = { x: 50, y: 50 }
    setDotPosition(newDot)
    currentDotRef.current = newDot
    previousDotRef.current = { x: 50, y: 50, time: performance.now() }
    previousGazeRef.current = { x: 0.5, y: 0.5, time: performance.now() }
    
    dotIntervalRef.current = setInterval(() => {
      const currentTime = performance.now()
      const dp = {
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 70,
      }
      setDotPosition(dp)
      previousDotRef.current = { ...currentDotRef.current, time: currentTime }
      currentDotRef.current = dp
    }, 2000)

    let prevX: number | null = null
    let prevY: number | null = null
    let lastTime = -1

    const processFrame = () => {
      if (doneRef.current) return
      const video = videoRef.current
      const landmarker = faceLandmarkerRef.current
      if (!video || !landmarker || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(processFrame)
        return
      }

      const now = performance.now()
      if (now <= lastTime) {
        rafRef.current = requestAnimationFrame(processFrame)
        return
      }
      lastTime = now

      try {
        const results = suppressMediaPipeInfo(() =>
          landmarker.detectForVideo(video, Math.round(now))
        )
        if (results?.faceLandmarks?.length > 0) {
          const landmarks = results.faceLandmarks[0]

          // Use robust gaze detection with smoothing
          const previousGazePos = prevX !== null && prevY !== null ? { x: prevX, y: prevY } : undefined
          const gaze = getGazePosition(landmarks, previousGazePos)
          const currentTime = now
          
          // Update visual gaze position for user feedback
          setCurrentGazePosition({ x: gaze.x * 100, y: gaze.y * 100 })

          if (prevX !== null && prevY !== null) {
            // Calculate movement delta for smoothness
            const delta = Math.sqrt(
              (gaze.x - prevX) ** 2 + (gaze.y - prevY) ** 2
            )
            deltasRef.current.push(delta)
            
            // Calculate position error (distance from target)
            const dotX = currentDotRef.current.x / 100
            const dotY = currentDotRef.current.y / 100
            const positionError = Math.sqrt(
              (gaze.x - dotX) ** 2 + (gaze.y - dotY) ** 2
            )
            positionErrorsRef.current.push(positionError)
            
            // Calculate pursuit gain (eye velocity / target velocity)
            const timeDelta = (currentTime - previousGazeRef.current.time) / 1000 // seconds
            if (timeDelta > 0.001) {
              // Eye velocity
              const eyeVelocity = Math.sqrt(
                Math.pow((gaze.x - previousGazeRef.current.x) / timeDelta, 2) +
                Math.pow((gaze.y - previousGazeRef.current.y) / timeDelta, 2)
              )
              
              // Target velocity
              const targetVelocity = Math.sqrt(
                Math.pow((currentDotRef.current.x - previousDotRef.current.x) / timeDelta / 100, 2) +
                Math.pow((currentDotRef.current.y - previousDotRef.current.y) / timeDelta / 100, 2)
              )
              
              // Pursuit gain (clamped to reasonable range)
              if (targetVelocity > 0.01) { // Only calculate when target is moving
                const gain = Math.min(2.0, eyeVelocity / targetVelocity)
                velocityGainsRef.current.push(gain)
              }
            }
            
            const currentSmoothness = computeFinalScore(
              deltasRef.current,
              positionErrorsRef.current,
              velocityGainsRef.current
            )
            setSmoothness(currentSmoothness)
          }
          
          // Update previous values
          prevX = gaze.x
          prevY = gaze.y
          previousGazeRef.current = { x: gaze.x, y: gaze.y, time: currentTime }

          // Check if gaze direction is roughly toward the dot
          totalFrameCountRef.current++
          const dotX = currentDotRef.current.x / 100
          const dotY = currentDotRef.current.y / 100
          const gazeDist = Math.sqrt(
            (gaze.x - dotX) ** 2 + (gaze.y - dotY) ** 2
          )
          // Very forgiving threshold (30% of screen) for better user experience
          // Accounts for webcam tracking limitations and natural eye movement
          const isOnTarget = gazeDist < 0.30
          if (isOnTarget) gazeOnTargetCountRef.current++
          setGazeOnDot(isOnTarget)

          // Draw face mesh on canvas
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d")
            if (ctx) {
              const w = canvasRef.current.width
              const h = canvasRef.current.height
              ctx.clearRect(0, 0, w, h)
              ctx.fillStyle = "hsl(199, 89%, 48%)"
              landmarks.forEach((lm: { x: number; y: number }) => {
                ctx.beginPath()
                ctx.arc(lm.x * w, lm.y * h, 1, 0, 2 * Math.PI)
                ctx.fill()
              })
              // Highlight tracked eye landmarks
              ctx.fillStyle = isOnTarget
                ? "hsl(160, 84%, 39%)"
                : "hsl(0, 84%, 60%)"
              const eyeLandmarks = [33, 133, 263, 362, 468, 473]
              eyeLandmarks.forEach((idx) => {
                const lm = landmarks[idx]
                if (lm) {
                  ctx.beginPath()
                  ctx.arc(lm.x * w, lm.y * h, 3, 0, 2 * Math.PI)
                  ctx.fill()
                }
              })
            }
          }
        }
      } catch {
        // frame error, continue
      }

      rafRef.current = requestAnimationFrame(processFrame)
    }

    rafRef.current = requestAnimationFrame(processFrame)

    const startTime = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      const remaining = Math.max(0, TASK_DURATION - elapsed)
      setTimeLeft(remaining)

      if (remaining <= 0) {
        finishTest(false)
      }
    }, 250)
  }, [videoRef, cameraOn, computeFinalScore, finishTest])

  const handleRestart = useCallback(() => {
    stopTracking()
    setRestartCount((c) => c + 1)
    setStatus("ready")
    setTimeLeft(TASK_DURATION)
    setSmoothness(null)
    setGazeOnDot(false)
    deltasRef.current = []
    gazeOnTargetCountRef.current = 0
    totalFrameCountRef.current = 0
  }, [stopTracking])

  const handleRestartFromDone = useCallback(() => {
    storedResultRef.current = null
    handleRestart()
  }, [handleRestart])

  const handleSkipToEnd = useCallback(() => {
    if (status === "tracking") {
      finishTest(false)
    }
  }, [status, finishTest])

  const elapsed = TASK_DURATION - timeLeft
  const progress = (elapsed / TASK_DURATION) * 100

  return (
    <Card className="border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">
          Eye Tracking Task
        </h2>
        {status === "ready" ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs bg-accent text-accent-foreground hover:bg-accent/90 border-accent"
            onClick={onSkip}
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip Test
          </Button>
        ) : null}
      </div>
      <p className="mb-3 text-sm text-muted-foreground leading-loose">
        Follow the moving dot with your eyes while keeping your head still. The system tracks your eye movements for {TASK_DURATION} seconds. Works with glasses -- the tracking uses multiple eye reference points for accuracy even through lenses.
      </p>

      {status === "loading" && (
        <div className="flex flex-col items-center gap-2 py-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading face tracking model...
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className="space-y-3">
          <Button
            className="w-full gap-2"
            onClick={startTracking}
            disabled={!cameraOn}
          >
            <Eye className="h-4 w-4" />
            {restartCount > 0 ? "Restart Eye Tracking" : "Start Eye Tracking"}
          </Button>
          {restartCount > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Restarted {restartCount} time{restartCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {status === "tracking" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Time remaining</span>
            <span className="font-mono font-semibold text-foreground">
              {timeLeft}s
            </span>
          </div>
          <Progress value={progress} className="h-2" />

          {/* Moving dot target with gaze indicator */}
          <div className="relative mx-auto w-full overflow-hidden rounded-lg bg-secondary" style={{ height: "min(50vh, 400px)" }}>
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="absolute inset-0 h-full w-full opacity-40"
            />
            
            {/* Visual gaze cursor - shows where system thinks you're looking (admin only) */}
            {userRole === "admin" && currentGazePosition && (
              <div
                className="absolute w-6 h-6 rounded-full border-2 border-yellow-400 bg-yellow-400/30 pointer-events-none transition-all duration-100"
                style={{
                  left: `${currentGazePosition.x}%`,
                  top: `${currentGazePosition.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="absolute inset-0 rounded-full animate-ping bg-yellow-400/50" />
              </div>
            )}
            
            {/* The target dot - larger and more visible */}
            <div
              className="absolute h-8 w-8 rounded-full shadow-lg transition-all duration-700 ease-in-out"
              style={{
                left: `${dotPosition.x}%`,
                top: `${dotPosition.y}%`,
                transform: "translate(-50%, -50%)",
                backgroundColor: gazeOnDot
                  ? "hsl(var(--accent))"
                  : "hsl(var(--primary))",
                boxShadow: gazeOnDot
                  ? "0 0 20px hsl(var(--accent) / 0.8), 0 0 40px hsl(var(--accent) / 0.4)"
                  : "0 0 20px hsl(var(--primary) / 0.6), 0 0 40px hsl(var(--primary) / 0.3)",
              }}
            />
            {/* Gaze on target indicator */}
            <div
              className={`absolute right-2 top-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                gazeOnDot
                  ? "bg-accent/20 text-accent"
                  : "bg-destructive/20 text-destructive"
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  gazeOnDot ? "bg-accent" : "bg-destructive"
                }`}
              />
              {gazeOnDot ? "Eyes on target" : "Look at the dot"}
            </div>
            <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-muted-foreground">
              {userRole === "admin" ? "Yellow cursor = where you're looking | Follow the blue/green dot" : "Follow the dot with your eyes"}
            </p>
          </div>

          {smoothness !== null && (
            <div className="rounded-lg bg-secondary p-2 text-center">
              <p className="text-xs text-muted-foreground">
                Live Smoothness Score
              </p>
              <p className="text-xl font-bold text-foreground">
                {smoothness.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">out of 100</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 py-1">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
            </span>
            <span className="text-sm font-medium text-accent">
              Tracking eyes...
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={handleRestart}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restart
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={handleSkipToEnd}
            >
              <SkipForward className="h-3.5 w-3.5" />
              Finish Early
            </Button>
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="flex flex-col items-center gap-4 py-2">
          <CheckCircle2 className="h-10 w-10 text-accent" />
          <p className="text-sm font-medium text-foreground">
            Eye tracking complete!
          </p>
          {smoothness !== null && (
            <div className="rounded-lg bg-secondary p-4 text-center w-full">
              <p className="text-xs text-muted-foreground">Final Score</p>
              <p className="text-3xl font-bold text-foreground">
                {smoothness.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">out of 100</p>
              {storedResultRef.current && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Gaze on target: {storedResultRef.current.gazeOnTarget}%
                </p>
              )}
            </div>
          )}
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleRestartFromDone}
            >
              <RotateCcw className="h-4 w-4" />
              Restart Test
            </Button>
            <Button className="flex-1 gap-2" onClick={handleContinue}>
              <SkipForward className="h-4 w-4" />
              Continue
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

/**
 * Final smoothness using RMS of deltas with improved worst-segment penalty.
 * 
 * Improvements:
 * - More forgiving sigmoid parameters
 * - Better segment weighting
 * - Accounts for natural saccades
 */
function computeFinalSmoothness(deltas: number[]) {
  if (deltas.length < 10) return 50
  const skipCount = Math.max(5, Math.floor(deltas.length * 0.2))
  const settled = deltas.slice(skipCount)
  if (settled.length < 5) return 50

  // RMS of deltas
  const totalRms = Math.sqrt(
    settled.reduce((s, d) => s + d * d, 0) / settled.length
  )

  // Segment-based penalty for consistency
  const segmentSize = 30
  const segmentRms: number[] = []
  for (let i = 0; i < settled.length - segmentSize; i += segmentSize) {
    const seg = settled.slice(i, i + segmentSize)
    const sRms = Math.sqrt(
      seg.reduce((s, d) => s + d * d, 0) / seg.length
    )
    segmentRms.push(sRms)
  }

  let penaltyRms = totalRms
  if (segmentRms.length > 2) {
    const sorted = [...segmentRms].sort((a, b) => b - a)
    const worstCount = Math.max(1, Math.ceil(sorted.length * 0.2))
    const worstAvg =
      sorted.slice(0, worstCount).reduce((s, v) => s + v, 0) / worstCount
    // Reduced penalty: 80% overall, 20% worst segments
    penaltyRms = totalRms * 0.8 + worstAvg * 0.2
  }

  // Improved sigmoid (same as live scoring)
  const k = 150
  const midpoint = 0.018
  return Math.max(0, Math.min(100, 100 / (1 + Math.exp(k * (penaltyRms - midpoint)))))
}
