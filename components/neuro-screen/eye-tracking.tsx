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
}

/**
 * Suppress MediaPipe's WASM INFO log routed through console.error.
 */
function suppressMediaPipeInfo<T>(fn: () => T): T {
  const origError = console.error
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Created TensorFlow Lite XNNPACK delegate for CPU")
    ) {
      return
    }
    origError.apply(console, args)
  }
  try {
    return fn()
  } finally {
    console.error = origError
  }
}

/**
 * Compute normalized gaze direction from iris landmarks.
 * Works with glasses by using multiple eye landmarks for robustness:
 * - Iris center (landmarks 468/473) for precise gaze when visible
 * - Eye corner midpoints (33/133 left, 263/362 right) as fallback
 * - Averages both eyes to reduce per-eye noise from glasses frames/reflections
 *
 * Glasses considerations (from MediaPipe face mesh documentation):
 * - Iris landmarks (468-477) may be less accurate through lenses
 * - Eye corner landmarks (33, 133, 263, 362) are more reliable with glasses
 * - We use a weighted blend: iris when detected, corners as fallback
 * - Averaging both eyes cancels out asymmetric lens distortion
 */
function getGazePosition(
  landmarks: Array<{ x: number; y: number; z: number }>
): { x: number; y: number; confidence: "high" | "medium" | "low" } {
  // Try iris landmarks first (most precise without glasses)
  const leftIris = landmarks[468] // left eye iris center
  const rightIris = landmarks[473] // right eye iris center

  // Eye corner landmarks (more reliable with glasses)
  const leftOuter = landmarks[33]
  const leftInner = landmarks[133]
  const rightInner = landmarks[362]
  const rightOuter = landmarks[263]

  // Use iris if available and within expected eye bounds
  if (leftIris && rightIris && leftOuter && leftInner && rightOuter && rightInner) {
    // Check if iris positions are within eye corners (validation for glasses)
    const leftEyeWidth = Math.abs(leftInner.x - leftOuter.x)
    const rightEyeWidth = Math.abs(rightOuter.x - rightInner.x)

    const leftIrisRelative =
      leftEyeWidth > 0.001
        ? (leftIris.x - leftOuter.x) / leftEyeWidth
        : 0.5
    const rightIrisRelative =
      rightEyeWidth > 0.001
        ? (rightIris.x - rightInner.x) / rightEyeWidth
        : 0.5

    // If iris positions seem valid (within 0-1 relative to eye width)
    if (
      leftIrisRelative >= -0.2 &&
      leftIrisRelative <= 1.2 &&
      rightIrisRelative >= -0.2 &&
      rightIrisRelative <= 1.2
    ) {
      return {
        x: (leftIris.x + rightIris.x) / 2,
        y: (leftIris.y + rightIris.y) / 2,
        confidence: "high",
      }
    }
  }

  // Fallback to eye center midpoints (works better with thick glasses)
  if (leftOuter && leftInner && rightOuter && rightInner) {
    const leftCenterX = (leftOuter.x + leftInner.x) / 2
    const leftCenterY = (leftOuter.y + leftInner.y) / 2
    const rightCenterX = (rightInner.x + rightOuter.x) / 2
    const rightCenterY = (rightInner.y + rightOuter.y) / 2
    return {
      x: (leftCenterX + rightCenterX) / 2,
      y: (leftCenterY + rightCenterY) / 2,
      confidence: "medium",
    }
  }

  // Last resort: use face center approximation
  const noseTip = landmarks[1]
  if (noseTip) {
    return { x: noseTip.x, y: noseTip.y - 0.05, confidence: "low" }
  }

  return { x: 0.5, y: 0.5, confidence: "low" }
}

export function EyeTracking({
  videoRef,
  cameraOn,
  onComplete,
  onSkip,
}: EyeTrackingProps) {
  const [status, setStatus] = useState<
    "loading" | "ready" | "tracking" | "done"
  >("loading")
  const [timeLeft, setTimeLeft] = useState(TASK_DURATION)
  const [smoothness, setSmoothness] = useState<number | null>(null)
  const [dotPosition, setDotPosition] = useState({ x: 50, y: 50 })
  const [gazeOnDot, setGazeOnDot] = useState(false)
  const [restartCount, setRestartCount] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const faceLandmarkerRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const deltasRef = useRef<number[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneRef = useRef(false)
  const gazeOnTargetCountRef = useRef(0)
  const totalFrameCountRef = useRef(0)
  const currentDotRef = useRef({ x: 50, y: 50 })

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
      faceLandmarkerRef.current?.close()
    }
  }, [])

  /**
   * Smoothness score using RMS of frame-to-frame deltas (same approach as hand tracking).
   * Sigmoid mapping for stable scoring.
   *
   * Normal tracking: mean delta ~0.002-0.004 -> score ~80-95
   * Mild irregularity: mean delta ~0.006-0.01 -> score ~55-75
   * Moderate: mean delta ~0.015-0.025 -> score ~30-50
   * Severe: mean delta >0.03 -> score <25
   */
  const computeSmoothness = useCallback((deltas: number[]) => {
    if (deltas.length < 10) return 50

    // Skip first 20% as settling
    const skipCount = Math.max(5, Math.floor(deltas.length * 0.2))
    const settled = deltas.slice(skipCount)
    if (settled.length < 5) return 50

    // RMS of deltas
    const rms = Math.sqrt(
      settled.reduce((s, d) => s + d * d, 0) / settled.length
    )

    // Sigmoid scoring
    const k = 200
    const midpoint = 0.012
    return Math.max(0, Math.min(100, 100 / (1 + Math.exp(k * (rms - midpoint)))))
  }, [])

  const stopTracking = useCallback(() => {
    doneRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (dotIntervalRef.current) clearInterval(dotIntervalRef.current)
  }, [])

  const finishTest = useCallback(
    (skipped: boolean) => {
      stopTracking()

      const allDeltas = deltasRef.current
      const finalSmoothness = skipped ? 0 : computeFinalSmoothness(allDeltas)
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

      setStatus("done")
      setTimeout(() => {
        onComplete({
          smoothness: Math.round(finalSmoothness * 10) / 10,
          samples: allDeltas.length,
          deltas: allDeltas.slice(-300),
          meanDelta,
          maxDelta,
          gazeOnTarget,
          wasSkipped: skipped,
          restartCount,
        })
      }, 0)
    },
    [stopTracking, onComplete, restartCount]
  )

  const startTracking = useCallback(() => {
    if (!faceLandmarkerRef.current || !videoRef.current || !cameraOn) return

    doneRef.current = false
    setStatus("tracking")
    deltasRef.current = []
    gazeOnTargetCountRef.current = 0
    totalFrameCountRef.current = 0
    setTimeLeft(TASK_DURATION)
    setSmoothness(null)
    setGazeOnDot(false)

    // Moving dot for user to follow
    const newDot = { x: 50, y: 50 }
    setDotPosition(newDot)
    currentDotRef.current = newDot
    dotIntervalRef.current = setInterval(() => {
      const dp = {
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 70,
      }
      setDotPosition(dp)
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

          // Use robust gaze detection that works with glasses
          const gaze = getGazePosition(landmarks)

          if (prevX !== null && prevY !== null) {
            const delta = Math.sqrt(
              (gaze.x - prevX) ** 2 + (gaze.y - prevY) ** 2
            )
            deltasRef.current.push(delta)
            const currentSmoothness = computeSmoothness(deltasRef.current)
            setSmoothness(currentSmoothness)
          }
          prevX = gaze.x
          prevY = gaze.y

          // Check if gaze is roughly toward the dot
          // The dot is in percentage coordinates (0-100), gaze is normalized (0-1)
          // Use a generous threshold since webcam gaze estimation is approximate
          totalFrameCountRef.current++
          const dotX = currentDotRef.current.x / 100
          const dotY = currentDotRef.current.y / 100
          const gazeDist = Math.sqrt(
            (gaze.x - dotX) ** 2 + (gaze.y - dotY) ** 2
          )
          // Threshold: ~15% of screen - generous because webcam gaze is imprecise
          const isOnTarget = gazeDist < 0.15
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
  }, [videoRef, cameraOn, computeSmoothness, finishTest])

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

  const handleSkipToEnd = useCallback(() => {
    if (status === "tracking") {
      finishTest(false)
    }
  }, [status, finishTest])

  const elapsed = TASK_DURATION - timeLeft
  const progress = (elapsed / TASK_DURATION) * 100

  return (
    <Card className="border-border bg-card p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">
          Eye Tracking Task
        </h2>
        {status === "idle" || status === "ready" ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={onSkip}
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip Test
          </Button>
        ) : null}
      </div>
      <p className="mb-2 text-sm text-muted-foreground leading-relaxed">
        Follow the moving dot with your eyes while keeping your head still. The
        system tracks your eye movements for {TASK_DURATION} seconds.
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        Works with glasses -- the tracking uses multiple eye reference points
        for accuracy even through lenses.
      </p>

      {status === "loading" && (
        <div className="flex flex-col items-center gap-3 py-4">
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
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Time remaining</span>
            <span className="font-mono font-semibold text-foreground">
              {timeLeft}s
            </span>
          </div>
          <Progress value={progress} className="h-2" />

          {/* Moving dot target with gaze indicator */}
          <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-lg bg-secondary">
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="absolute inset-0 h-full w-full opacity-40"
            />
            {/* The dot */}
            <div
              className="absolute h-5 w-5 rounded-full shadow-lg transition-all duration-700 ease-in-out"
              style={{
                left: `${dotPosition.x}%`,
                top: `${dotPosition.y}%`,
                transform: "translate(-50%, -50%)",
                backgroundColor: gazeOnDot
                  ? "hsl(var(--accent))"
                  : "hsl(var(--primary))",
                boxShadow: gazeOnDot
                  ? "0 0 12px hsl(var(--accent) / 0.6)"
                  : "0 0 12px hsl(var(--primary) / 0.5)",
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
              Follow the dot with your eyes
            </p>
          </div>

          {smoothness !== null && (
            <div className="rounded-lg bg-secondary p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Live Smoothness Score
              </p>
              <p className="text-3xl font-bold text-foreground">
                {smoothness.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">out of 100</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
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
        <div className="flex flex-col items-center gap-3">
          <CheckCircle2 className="h-10 w-10 text-accent" />
          <p className="text-sm font-medium text-foreground">
            Eye tracking complete! Preparing results...
          </p>
        </div>
      )}
    </Card>
  )
}

/**
 * Final smoothness using RMS of deltas with worst-segment penalty.
 * Same sigmoid approach as hand tracking for consistency.
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

  // Segment-based penalty
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
    const worstCount = Math.max(1, Math.ceil(sorted.length * 0.25))
    const worstAvg =
      sorted.slice(0, worstCount).reduce((s, v) => s + v, 0) / worstCount
    penaltyRms = totalRms * 0.7 + worstAvg * 0.3
  }

  const k = 200
  const midpoint = 0.012
  return Math.max(0, Math.min(100, 100 / (1 + Math.exp(k * (penaltyRms - midpoint)))))
}
