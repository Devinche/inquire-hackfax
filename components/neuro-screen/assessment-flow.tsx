"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Hand,
  CheckCircle2,
  Loader2,
  SkipForward,
  RotateCcw,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { HandData } from "./assessment-flow"

const TASK_DURATION = 15

interface HandTrackingProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  cameraOn: boolean
  onComplete: (data: HandData) => void
  onSkip?: () => void
}

export function HandTracking({
  videoRef,
  cameraOn,
  onComplete,
  onSkip,
}: HandTrackingProps) {
  const [status, setStatus] = useState<
    "loading" | "ready" | "countdown" | "tracking" | "done"
  >("loading")

  const [timeLeft, setTimeLeft] = useState(TASK_DURATION)
  const [stability, setStability] = useState<number | null>(null)
  const [countdownValue, setCountdownValue] = useState(3)
  const [restartCount, setRestartCount] = useState(0)

  const handLandmarkerRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const positionsRef = useRef<Array<{ x: number; y: number }>>([])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const doneRef = useRef(false)
  const storedResultRef = useRef<HandData | null>(null)

  // -------------------------------
  // Load MediaPipe model
  // -------------------------------
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

  // -------------------------------
  // Draw landmarks
  // -------------------------------
  const drawLandmarks = useCallback((landmarks: any) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = "#00FFAA"
    ctx.strokeStyle = "#00FFAA"
    ctx.lineWidth = 2

    landmarks.forEach((lm: any) => {
      const x = lm.x * canvas.width
      const y = lm.y * canvas.height

      ctx.beginPath()
      ctx.arc(x, y, 4, 0, 2 * Math.PI)
      ctx.fill()
    })
  }, [videoRef])

  // -------------------------------
  // RMS Stability (sigmoid)
  // -------------------------------
  const computeStability = useCallback(
    (points: Array<{ x: number; y: number }>) => {
      if (points.length < 20) return 50

      const skip = Math.floor(points.length * 0.3)
      const settled = points.slice(skip)
      if (settled.length < 10) return 50

      const meanX =
        settled.reduce((s, p) => s + p.x, 0) / settled.length
      const meanY =
        settled.reduce((s, p) => s + p.y, 0) / settled.length

      const rms = Math.sqrt(
        settled.reduce(
          (s, p) => s + (p.x - meanX) ** 2 + (p.y - meanY) ** 2,
          0
        ) / settled.length
      )

      const k = 150
      const midpoint = 0.02

      return 100 / (1 + Math.exp(k * (rms - midpoint)))
    },
    []
  )

  // -------------------------------
  // Begin tracking loop
  // -------------------------------
  const beginTracking = useCallback(() => {
    if (!handLandmarkerRef.current || !videoRef.current) return

    doneRef.current = false
    setStatus("tracking")
    setTimeLeft(TASK_DURATION)
    positionsRef.current = []
    setStability(null)

    let lastTime = -1

    const processFrame = () => {
      if (doneRef.current) return

      const video = videoRef.current
      const landmarker = handLandmarkerRef.current

      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(processFrame)
        return
      }

      const now = performance.now()
      if (now <= lastTime) {
        rafRef.current = requestAnimationFrame(processFrame)
        return
      }
      lastTime = now

      const results = landmarker.detectForVideo(video, Math.round(now))

      if (results?.landmarks?.length > 0) {
        const wrist = results.landmarks[0][0]
        positionsRef.current.push({ x: wrist.x, y: wrist.y })

        drawLandmarks(results.landmarks[0])

        const score = computeStability(positionsRef.current)
        setStability(score)
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
        finishTest()
      }
    }, 250)
  }, [videoRef, computeStability, drawLandmarks])

  // -------------------------------
  // Countdown
  // -------------------------------
  const startTracking = useCallback(() => {
    if (!cameraOn) return

    setStatus("countdown")
    setCountdownValue(3)

    let count = 3
    const id = setInterval(() => {
      count--
      setCountdownValue(count)
      if (count <= 0) {
        clearInterval(id)
        beginTracking()
      }
    }, 1000)
  }, [cameraOn, beginTracking])

  // -------------------------------
  // Finish
  // -------------------------------
  const finishTest = useCallback(() => {
    doneRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)

    const finalScore = computeStability(positionsRef.current)

    const result: HandData = {
      stability: Math.round(finalScore * 10) / 10,
      samples: positionsRef.current.length,
      positions: positionsRef.current.slice(-300),
      varianceX: 0,
      varianceY: 0,
    }

    storedResultRef.current = result
    setStability(finalScore)
    setStatus("done")
  }, [computeStability])

  const handleContinue = () => {
    if (storedResultRef.current) {
      onComplete(storedResultRef.current)
    }
  }

  const handleRestart = () => {
    doneRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRestartCount((c) => c + 1)
    setStatus("ready")
  }

  const progress = ((TASK_DURATION - timeLeft) / TASK_DURATION) * 100

  return (
    <Card className="border-border bg-card p-6 space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Motor Task</h2>

      <canvas
        ref={canvasRef}
        className="absolute pointer-events-none"
      />

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

      {status === "countdown" && (
        <div className="text-center text-4xl font-bold text-primary">
          {countdownValue}
        </div>
      )}

      {status === "tracking" && (
        <>
          <Progress value={progress} className="h-2" />
          {stability !== null && (
            <div className="text-center">
              <p className="text-3xl font-bold">
                {stability.toFixed(1)}
              </p>
            </div>
          )}
        </>
      )}

      {status === "done" && (
        <div className="space-y-3 text-center">
          <CheckCircle2 className="h-8 w-8 mx-auto text-accent" />
          <p className="text-2xl font-bold">
            {stability?.toFixed(1)}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRestart}>
              Restart
            </Button>
            <Button onClick={handleContinue}>
              Continue
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
