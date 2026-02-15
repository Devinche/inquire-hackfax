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
   * Rolling-window smoothness: uses last N deltas so early jitter
   * from settling doesn't permanently ruin the score.
   */
  const computeSmoothness = useCallback((deltas: number[]) => {
    if (deltas.length < 5) return 50 // neutral start
    // Use rolling window of last 60 deltas
    const window = deltas.slice(-60)
    const avg = window.reduce((s, d) => s + d, 0) / window.length
    // Softer scaling factor
    return Math.max(0, Math.min(100, 100 - avg * 4000))
  }, [])

  const startTracking = useCallback(() => {
    if (!faceLandmarkerRef.current || !videoRef.current || !cameraOn) return

    setStatus("tracking")
    deltasRef.current = []
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
 * Final smoothness: skip first 10% of deltas (settling period),
 * then compute from the remaining data.
 */
function computeFinalSmoothness(deltas: number[]) {
  if (deltas.length < 10) return 50
  const skipCount = Math.floor(deltas.length * 0.1)
  const settled = deltas.slice(skipCount)
  const avg = settled.reduce((s, d) => s + d, 0) / settled.length
  return Math.max(0, Math.min(100, 100 - avg * 4000))
}
