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
  const origInfo = console.info
  const origLog = console.log
  
  console.error = (...args: unknown[]) => {
    const msg = String(args[0] || '')
    if (
      msg.includes("Created TensorFlow Lite XNNPACK delegate for CPU") ||
      msg.includes("INFO:")
    ) {
      return
    }
    origError.apply(console, args)
  }
  
  console.info = (...args: unknown[]) => {
    const msg = String(args[0] || '')
    if (msg.includes("Created TensorFlow Lite XNNPACK delegate for CPU")) {
      return
    }
    origInfo.apply(console, args)
  }
  
  console.log = (...args: unknown[]) => {
    const msg = String(args[0] || '')
    if (msg.includes("Created TensorFlow Lite XNNPACK delegate for CPU")) {
      return
    }
    origLog.apply(console, args)
  }
  
  try {
    return fn()
  } finally {
    console.error = origError
    console.info = origInfo
    console.log = origLog
  }
}

/**
 * Compute RELATIVE gaze direction from iris landmarks.
 *
 * KEY INSIGHT: We compute where the iris sits WITHIN the eye socket (relative to
 * the eye corners), NOT the absolute position of the iris in the camera frame.
 * This means head movement does NOT affect the gaze reading -- only actual eye
 * movement (looking left/right/up/down) changes the output.
 *
 * For each eye:
 *   gazeX = (iris.x - outerCorner.x) / (innerCorner.x - outerCorner.x)
 *     => 0.0 = looking fully outer, 0.5 = center, 1.0 = looking fully inner
 *   gazeY = (iris.y - topLid.y) / (bottomLid.y - topLid.y)
 *     => 0.0 = looking up, 0.5 = center, 1.0 = looking down
 *
 * We average both eyes and map the result to 0-1 screen space.
 *
 * Works with glasses because lens refraction shifts iris AND eye corners
 * roughly equally, so the relative position is preserved.
 */
function getGazePosition(
  landmarks: Array<{ x: number; y: number; z: number }>
): { x: number; y: number; confidence: "high" | "medium" | "low" } {
  // Iris center landmarks
  const leftIris = landmarks[468]
  const rightIris = landmarks[473]

  // Left eye corners and lids
  const leftOuter = landmarks[33]
  const leftInner = landmarks[133]
  const leftTop = landmarks[159]    // upper eyelid center
  const leftBottom = landmarks[145] // lower eyelid center

  // Right eye corners and lids
  const rightInner = landmarks[362]
  const rightOuter = landmarks[263]
  const rightTop = landmarks[386]    // upper eyelid center
  const rightBottom = landmarks[374] // lower eyelid center

  if (
    leftIris && rightIris &&
    leftOuter && leftInner && leftTop && leftBottom &&
    rightOuter && rightInner && rightTop && rightBottom
  ) {
    const leftEyeWidth = Math.abs(leftInner.x - leftOuter.x)
    const rightEyeWidth = Math.abs(rightOuter.x - rightInner.x)
    const leftEyeHeight = Math.abs(leftBottom.y - leftTop.y)
    const rightEyeHeight = Math.abs(rightBottom.y - rightTop.y)

    if (leftEyeWidth > 0.001 && rightEyeWidth > 0.001 &&
        leftEyeHeight > 0.001 && rightEyeHeight > 0.001) {
      // Iris position relative to eye socket (0 = outer/top, 1 = inner/bottom)
      const leftRelX = (leftIris.x - leftOuter.x) / leftEyeWidth
      const leftRelY = (leftIris.y - leftTop.y) / leftEyeHeight
      const rightRelX = (rightIris.x - rightInner.x) / rightEyeWidth
      const rightRelY = (rightIris.y - rightTop.y) / rightEyeHeight

      // Average both eyes for stability (cancels asymmetric noise/glasses distortion)
      const gazeRelX = (leftRelX + rightRelX) / 2
      const gazeRelY = (leftRelY + rightRelY) / 2

      // Map to 0-1 screen space: center of eye (0.5 relative) -> 0.5 screen
      // Amplify to make gaze direction actually map across screen area
      // Eyes typically move iris 0.3-0.7 relative within the socket
      const screenX = 0.5 + (gazeRelX - 0.5) * 2.5
      const screenY = 0.5 + (gazeRelY - 0.5) * 2.0

      return {
        x: Math.max(0, Math.min(1, screenX)),
        y: Math.max(0, Math.min(1, screenY)),
        confidence: "high",
      }
    }
  }

  // Fallback: try just eye corners (works with thick glasses that occlude iris)
  if (leftOuter && leftInner && rightOuter && rightInner && leftTop && rightTop && leftBottom && rightBottom) {
    // Use eye openness ratio as a proxy for vertical gaze
    const leftOpenness = Math.abs(leftBottom.y - leftTop.y) / (Math.abs(leftInner.x - leftOuter.x) || 0.001)
    const rightOpenness = Math.abs(rightBottom.y - rightTop.y) / (Math.abs(rightOuter.x - rightInner.x) || 0.001)
    const avgOpenness = (leftOpenness + rightOpenness) / 2
    return {
      x: 0.5, // can't determine horizontal gaze without iris
      y: Math.max(0, Math.min(1, 0.5 + (avgOpenness - 0.3) * 2)),
      confidence: "medium",
    }
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
      try {
        faceLandmarkerRef.current?.close()
      } catch (err) {
        // Suppress MediaPipe WASM cleanup errors
      }
    }
  }, [])

  /**
   * Smoothness score using RMS of frame-to-frame deltas with improved parameters.
   * 
   * Improvements:
   * - More realistic thresholds based on actual eye movement patterns
   * - Better handling of saccades vs smooth pursuit
   * - More forgiving for natural eye jitter
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

    // Improved sigmoid scoring
    // More forgiving for natural eye movements
    //   RMS ~0.003 -> ~95 (very smooth)
    //   RMS ~0.008 -> ~85 (smooth, normal)
    //   RMS ~0.015 -> ~70 (acceptable)
    //   RMS ~0.025 -> ~50 (mild irregularity)
    //   RMS ~0.040 -> ~30 (moderate issues)
    const k = 150 // steepness
    const midpoint = 0.018 // more forgiving midpoint
    return Math.max(0, Math.min(100, 100 / (1 + Math.exp(k * (rms - midpoint)))))
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
      const rawSmoothness = skipped ? 0 : computeFinalSmoothness(allDeltas)
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

      // Factor gazeOnTarget into score with improved weighting
      // If gaze was on target less than 50% of the time, apply a penalty
      let finalSmoothness = rawSmoothness
      if (!skipped && gazeOnTarget < 50) {
        const gazePenalty = 0.6 + (gazeOnTarget / 50) * 0.4
        finalSmoothness = rawSmoothness * gazePenalty
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
    [stopTracking, restartCount]
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

          // Check if gaze direction is roughly toward the dot
          // Improved threshold based on actual tracking capabilities
          totalFrameCountRef.current++
          const dotX = currentDotRef.current.x / 100
          const dotY = currentDotRef.current.y / 100
          const gazeDist = Math.sqrt(
            (gaze.x - dotX) ** 2 + (gaze.y - dotY) ** 2
          )
          // More realistic threshold (20% of screen) for iris-relative gaze
          // Accounts for webcam tracking limitations while still being meaningful
          const isOnTarget = gazeDist < 0.20
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
    <Card className="border-border bg-card p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">
          Eye Tracking Task
        </h2>
        {status === "ready" ? (
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
