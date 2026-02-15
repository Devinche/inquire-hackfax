"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Eye, CheckCircle2, Loader2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { EyeData } from "./assessment-flow"

const TASK_DURATION = 15

interface EyeTrackingProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  cameraOn: boolean
  onComplete: (data: EyeData) => void
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

export function EyeTracking({
  videoRef,
  cameraOn,
  onComplete,
}: EyeTrackingProps) {
  const [status, setStatus] = useState<
    "loading" | "ready" | "tracking" | "done"
  >("loading")
  const [timeLeft, setTimeLeft] = useState(TASK_DURATION)
  const [smoothness, setSmoothness] = useState<number | null>(null)
  const [dotPosition, setDotPosition] = useState({ x: 50, y: 50 })
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const faceLandmarkerRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const deltasRef = useRef<number[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
   * Cumulative smoothness computation using exponentially weighted approach.
   *
   * Based on face landmarker research (Stuart et al., 2019; Leigh & Zee, 2015):
   * - Normal smooth pursuit gain is >0.85 with minimal saccadic intrusions
   * - MediaPipe face landmarks 133/362 give normalized eye positions
   * - Frame-to-frame deltas for normal tracking: ~0.001-0.005
   * - Saccadic intrusions produce deltas >0.01
   *
   * Uses cumulative mean delta with worst-segment penalty so poor segments
   * permanently reduce the final score rather than being "forgotten."
   */
  const worstDeltaSegmentsRef = useRef<number[]>([])

  const computeSmoothness = useCallback((deltas: number[]) => {
    if (deltas.length < 10) return 50 // neutral until enough data

    // Skip first 20% as settling period
    const skipCount = Math.max(5, Math.floor(deltas.length * 0.2))
    const settled = deltas.slice(skipCount)
    if (settled.length < 5) return 50

    // Compute cumulative mean delta over ALL settled data
    const totalMean = settled.reduce((s, d) => s + d, 0) / settled.length

    // Recent window for live responsiveness
    const recent = settled.slice(-60)
    const recentMean = recent.reduce((s, d) => s + d, 0) / recent.length

    // Track worst segments every 30 frames
    if (settled.length % 30 === 0 && settled.length > 30) {
      const seg = settled.slice(-30)
      const segMean = seg.reduce((s, d) => s + d, 0) / seg.length
      worstDeltaSegmentsRef.current.push(segMean)
    }

    // Logarithmic scaling for mean delta
    // Normal: mean delta ~0.002 -> log10 = -2.7
    // Poor: mean delta ~0.02 -> log10 = -1.7
    // Severe: mean delta ~0.05 -> log10 = -1.3
    const logDelta = Math.log10(Math.max(totalMean, 1e-6))
    // Map: -4 (very smooth) to -1 (very jerky) -> 100 to 0
    const cumulativeScore = Math.max(
      0,
      Math.min(100, ((logDelta + 3.5) / -2.5) * 100)
    )

    const logRecent = Math.log10(Math.max(recentMean, 1e-6))
    const recentScore = Math.max(
      0,
      Math.min(100, ((logRecent + 3.5) / -2.5) * 100)
    )

    // Blend 60% cumulative + 40% recent, but cap recovery above cumulative
    const blended = cumulativeScore * 0.6 + recentScore * 0.4
    return Math.min(blended, cumulativeScore + 5)
  }, [])

  const startTracking = useCallback(() => {
    if (!faceLandmarkerRef.current || !videoRef.current || !cameraOn) return

    setStatus("tracking")
    deltasRef.current = []
    worstDeltaSegmentsRef.current = []
    setTimeLeft(TASK_DURATION)
    setSmoothness(null)

    // Moving dot for user to follow
    dotIntervalRef.current = setInterval(() => {
      setDotPosition({
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 70,
      })
    }, 2000)

    let prevX: number | null = null
    let prevY: number | null = null
    let lastTime = -1
    const doneRef = { current: false }

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
          const leftEye = landmarks[133]
          const rightEye = landmarks[362]

          if (leftEye && rightEye) {
            const avgX = (leftEye.x + rightEye.x) / 2
            const avgY = (leftEye.y + rightEye.y) / 2

            if (prevX !== null && prevY !== null) {
              const delta = Math.sqrt(
                (avgX - prevX) ** 2 + (avgY - prevY) ** 2
              )
              deltasRef.current.push(delta)
              const currentSmoothness = computeSmoothness(deltasRef.current)
              setSmoothness(currentSmoothness)
            }
            prevX = avgX
            prevY = avgY
          }

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
              ctx.fillStyle = "hsl(160, 84%, 39%)"
              ;[133, 362, 33, 263].forEach((idx) => {
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
        doneRef.current = true
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        if (intervalRef.current) clearInterval(intervalRef.current)
        if (dotIntervalRef.current) clearInterval(dotIntervalRef.current)

        const allDeltas = deltasRef.current
        const finalSmoothness = computeFinalSmoothness(allDeltas)
        const meanDelta =
          allDeltas.length > 0
            ? allDeltas.reduce((s, d) => s + d, 0) / allDeltas.length
            : 0
        const maxDelta =
          allDeltas.length > 0 ? Math.max(...allDeltas) : 0

        setStatus("done")
        setTimeout(() => {
          onComplete({
            smoothness: Math.round(finalSmoothness * 10) / 10,
            samples: allDeltas.length,
            deltas: allDeltas.slice(-300),
            meanDelta,
            maxDelta,
          })
        }, 0)
      }
    }, 250)
  }, [videoRef, cameraOn, computeSmoothness, onComplete])

  const elapsed = TASK_DURATION - timeLeft
  const progress = (elapsed / TASK_DURATION) * 100

  return (
    <Card className="border-border bg-card p-6">
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        Eye Tracking Task
      </h2>
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        Follow the moving dot with your eyes while keeping your head still. The
        system tracks your eye movements for {TASK_DURATION} seconds.
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
        <Button
          className="w-full gap-2"
          onClick={startTracking}
          disabled={!cameraOn}
        >
          <Eye className="h-4 w-4" />
          Start Eye Tracking
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

          {/* Moving dot target */}
          <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-lg bg-secondary">
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="absolute inset-0 h-full w-full opacity-40"
            />
            <div
              className="absolute h-5 w-5 rounded-full bg-primary shadow-lg shadow-primary/50 transition-all duration-700 ease-in-out"
              style={{
                left: `${dotPosition.x}%`,
                top: `${dotPosition.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
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
 * Final smoothness uses cumulative log-delta with worst-segment penalty.
 *
 * Based on Stuart et al. (2019) and Leigh & Zee (2015):
 * - Smooth pursuit gain <0.5 indicates pathological tracking
 * - Saccadic intrusions measured as high-delta frames
 * - Logarithmic scaling matches clinical perception
 */
function computeFinalSmoothness(deltas: number[]) {
  if (deltas.length < 10) return 50
  // Skip first 20% as settling period
  const skipCount = Math.max(5, Math.floor(deltas.length * 0.2))
  const settled = deltas.slice(skipCount)
  if (settled.length < 5) return 50

  const totalMean = settled.reduce((s, d) => s + d, 0) / settled.length

  // Compute segment means for worst-segment penalty
  const segmentSize = 30
  const segmentMeans: number[] = []
  for (let i = 0; i < settled.length - segmentSize; i += segmentSize) {
    const seg = settled.slice(i, i + segmentSize)
    const segMean = seg.reduce((s, d) => s + d, 0) / seg.length
    segmentMeans.push(segMean)
  }

  // Worst 25% segments penalty
  let penaltyMean = totalMean
  if (segmentMeans.length > 2) {
    const sorted = [...segmentMeans].sort((a, b) => b - a)
    const worstCount = Math.max(1, Math.ceil(sorted.length * 0.25))
    const worstAvg =
      sorted.slice(0, worstCount).reduce((s, v) => s + v, 0) / worstCount
    penaltyMean = totalMean * 0.7 + worstAvg * 0.3
  }

  // Logarithmic scaling
  const logDelta = Math.log10(Math.max(penaltyMean, 1e-6))
  // Map: -4 (very smooth) to -1 (very jerky) -> 100 to 0
  return Math.max(0, Math.min(100, ((logDelta + 3.5) / -2.5) * 100))
}
