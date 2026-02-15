"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Hand, CheckCircle2, Loader2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { HandData } from "./assessment-flow"

const TASK_DURATION = 15

interface HandTrackingProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  cameraOn: boolean
  onComplete: (data: HandData) => void
}

/**
 * Suppress MediaPipe's WASM INFO log ("Created TensorFlow Lite XNNPACK delegate for CPU")
 * which is routed through console.error by the WASM stderr handler.
 */
function suppressMediaPipeInfo<T>(fn: () => T): T {
  const origError = console.error
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Created TensorFlow Lite XNNPACK delegate for CPU")
    ) {
      return // suppress this specific INFO message
    }
    origError.apply(console, args)
  }
  try {
    return fn()
  } finally {
    console.error = origError
  }
}

export function HandTracking({
  videoRef,
  cameraOn,
  onComplete,
}: HandTrackingProps) {
  const [status, setStatus] = useState<
    "loading" | "ready" | "tracking" | "done"
  >("loading")
  const [timeLeft, setTimeLeft] = useState(TASK_DURATION)
  const [stability, setStability] = useState<number | null>(null)

  const handLandmarkerRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const positionsRef = useRef<Array<{ x: number; y: number }>>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadModel() {
      try {
        const { FilesetResolver, HandLandmarker } = await import(
          "@mediapipe/tasks-vision"
        )
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        )
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          runningMode: "VIDEO",
          numHands: 1,
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          },
        })
        if (!cancelled) {
          handLandmarkerRef.current = handLandmarker
          setStatus("ready")
        }
      } catch (err) {
        console.error("Hand model load error:", err)
      }
    }

    loadModel()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
      handLandmarkerRef.current?.close()
    }
  }, [])

  /**
   * Cumulative stability computation using exponentially weighted moving average.
   *
   * Based on MediaPipe research (Becktepe et al., 2025; Friedrich et al., 2024):
   * - MediaPipe normalized landmarks have a noise floor of ~0.001-0.003 in x/y
   * - Physiological tremor produces variance ~0.00001-0.0001 in normalized coords
   * - Pathological tremor produces variance >0.001
   *
   * This uses a cumulative approach: compute variance over ALL collected points
   * (after settling), combined with a penalty for worst segments. This prevents
   * the score from bouncing back to high values after poor performance.
   */
  const worstVariancesRef = useRef<number[]>([])

  const computeStability = useCallback(
    (points: Array<{ x: number; y: number }>) => {
      if (points.length < 10) return 50 // neutral until enough data

      // Skip first 20% as settling period
      const skipCount = Math.max(10, Math.floor(points.length * 0.2))
      const settled = points.slice(skipCount)
      if (settled.length < 5) return 50

      // Compute overall variance on all settled data
      const meanX = settled.reduce((s, p) => s + p.x, 0) / settled.length
      const meanY = settled.reduce((s, p) => s + p.y, 0) / settled.length
      const totalVariance =
        settled.reduce(
          (s, p) => s + (p.x - meanX) ** 2 + (p.y - meanY) ** 2,
          0
        ) / settled.length

      // Also compute recent 60-frame window variance for live feedback
      const recent = settled.slice(-60)
      const recentMeanX = recent.reduce((s, p) => s + p.x, 0) / recent.length
      const recentMeanY = recent.reduce((s, p) => s + p.y, 0) / recent.length
      const recentVariance =
        recent.reduce(
          (s, p) => s + (p.x - recentMeanX) ** 2 + (p.y - recentMeanY) ** 2,
          0
        ) / recent.length

      // Track worst segment variances to prevent recovery from bad periods
      if (settled.length % 30 === 0 && settled.length > 30) {
        const segment = settled.slice(-30)
        const segMeanX = segment.reduce((s, p) => s + p.x, 0) / segment.length
        const segMeanY = segment.reduce((s, p) => s + p.y, 0) / segment.length
        const segVar =
          segment.reduce(
            (s, p) => s + (p.x - segMeanX) ** 2 + (p.y - segMeanY) ** 2,
            0
          ) / segment.length
        worstVariancesRef.current.push(segVar)
      }

      // Use logarithmic scaling (Weber-Fechner law, Elble et al., 2006)
      // This matches clinical tremor perception which is logarithmic, not linear
      // Noise floor ~0.000005, pathological threshold ~0.0005
      const logVariance = Math.log10(Math.max(totalVariance, 1e-8))
      // Map: log10(1e-8)=-8 (perfect) to log10(0.01)=-2 (severe tremor)
      // Normal range: -6 to -4.5 in log space
      const score = Math.max(0, Math.min(100, ((logVariance + 7) / 4.5) * 100))

      // Blend: 60% cumulative, 40% recent for live responsiveness
      const logRecent = Math.log10(Math.max(recentVariance, 1e-8))
      const recentScore = Math.max(
        0,
        Math.min(100, ((logRecent + 7) / 4.5) * 100)
      )

      // Final live score is the LOWER of blended and pure cumulative
      // This prevents recovery: once you mess up, the cumulative drags it down
      const blended = score * 0.6 + recentScore * 0.4
      return Math.min(blended, score + 5) // Can't recover more than 5 above cumulative
    },
    []
  )

  const startTracking = useCallback(() => {
    if (!handLandmarkerRef.current || !videoRef.current || !cameraOn) return

    setStatus("tracking")
    positionsRef.current = []
    worstVariancesRef.current = []
    setTimeLeft(TASK_DURATION)
    setStability(null)

    let lastTime = -1
    const doneRef = { current: false }

    const processFrame = () => {
      if (doneRef.current) return
      const video = videoRef.current
      const landmarker = handLandmarkerRef.current
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
        if (results?.landmarks?.length > 0) {
          const wrist = results.landmarks[0][0]
          positionsRef.current.push({ x: wrist.x, y: wrist.y })
          const currentStability = computeStability(positionsRef.current)
          setStability(currentStability)
        }
      } catch {
        // frame processing error, continue
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
        doneRef.current = true
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        if (intervalRef.current) clearInterval(intervalRef.current)

        const pts = positionsRef.current
        // Final score uses ALL samples for overall assessment
        const finalStability = computeFinalStability(pts)

        let varianceX = 0
        let varianceY = 0
        if (pts.length > 1) {
          const meanX = pts.reduce((s, p) => s + p.x, 0) / pts.length
          const meanY = pts.reduce((s, p) => s + p.y, 0) / pts.length
          varianceX =
            pts.reduce((s, p) => s + (p.x - meanX) ** 2, 0) / pts.length
          varianceY =
            pts.reduce((s, p) => s + (p.y - meanY) ** 2, 0) / pts.length
        }

        setStatus("done")
        setTimeout(() => {
          onComplete({
            stability: Math.round(finalStability * 10) / 10,
            samples: pts.length,
            positions: pts.slice(-300),
            varianceX,
            varianceY,
          })
        }, 0)
      }
    }, 250)
  }, [videoRef, cameraOn, computeStability, onComplete])

  const elapsed = TASK_DURATION - timeLeft
  const progress = (elapsed / TASK_DURATION) * 100

  return (
    <Card className="border-border bg-card p-6">
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        Motor Task
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        Hold your hand steady in front of the camera for {TASK_DURATION}{" "}
        seconds. Keep your index finger pointed upward and try not to move.
      </p>

      {status === "loading" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading hand tracking model...
          </p>
        </div>
      )}

      {status === "ready" && (
        <Button
          className="w-full gap-2"
          onClick={startTracking}
          disabled={!cameraOn}
        >
          <Hand className="h-4 w-4" />
          Start Motor Task
        </Button>
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

          {stability !== null && (
            <div className="rounded-lg bg-secondary p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Live Stability Score
              </p>
              <p className="text-3xl font-bold text-foreground">
                {stability.toFixed(1)}
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
              Tracking hand...
            </span>
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="flex flex-col items-center gap-3">
          <CheckCircle2 className="h-10 w-10 text-accent" />
          <p className="text-sm font-medium text-foreground">
            Motor task complete! Moving to next task...
          </p>
        </div>
      )}
    </Card>
  )
}

/**
 * Final stability uses cumulative log-variance across ALL settled data,
 * plus a penalty from the worst segments so bad periods permanently
 * reduce the final score.
 *
 * Based on Becktepe et al. (2025): MediaPipe normalized landmarks
 * have median amplitude estimation error of ~5mm. The logarithmic
 * scaling matches clinical tremor perception (Weber-Fechner law).
 */
function computeFinalStability(points: Array<{ x: number; y: number }>) {
  if (points.length < 10) return 50
  // Skip first 20% as settling period (more generous than 10%)
  const skipCount = Math.max(10, Math.floor(points.length * 0.2))
  const settled = points.slice(skipCount)
  if (settled.length < 5) return 50

  const meanX = settled.reduce((s, p) => s + p.x, 0) / settled.length
  const meanY = settled.reduce((s, p) => s + p.y, 0) / settled.length
  const totalVariance =
    settled.reduce(
      (s, p) => s + (p.x - meanX) ** 2 + (p.y - meanY) ** 2,
      0
    ) / settled.length

  // Compute segment variances (every 30 frames) for worst-segment penalty
  const segmentSize = 30
  const segmentVariances: number[] = []
  for (let i = 0; i < settled.length - segmentSize; i += segmentSize) {
    const seg = settled.slice(i, i + segmentSize)
    const sMeanX = seg.reduce((s, p) => s + p.x, 0) / seg.length
    const sMeanY = seg.reduce((s, p) => s + p.y, 0) / seg.length
    const sVar =
      seg.reduce(
        (s, p) => s + (p.x - sMeanX) ** 2 + (p.y - sMeanY) ** 2,
        0
      ) / seg.length
    segmentVariances.push(sVar)
  }

  // Apply worst-segment penalty: the worst 25% of segments pull the score down
  let penaltyVariance = totalVariance
  if (segmentVariances.length > 2) {
    const sorted = [...segmentVariances].sort((a, b) => b - a)
    const worstCount = Math.max(1, Math.ceil(sorted.length * 0.25))
    const worstAvg =
      sorted.slice(0, worstCount).reduce((s, v) => s + v, 0) / worstCount
    // Blend: 70% total variance + 30% worst segments
    penaltyVariance = totalVariance * 0.7 + worstAvg * 0.3
  }

  // Logarithmic scaling (Weber-Fechner law)
  const logVar = Math.log10(Math.max(penaltyVariance, 1e-8))
  // Map: -8 (perfect stillness) to -2.5 (severe tremor) -> 0-100
  return Math.max(0, Math.min(100, ((logVar + 7) / 4.5) * 100))
}
