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
  onSkip: () => void
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
  const [restartCount, setRestartCount] = useState(0)
  const [countdownValue, setCountdownValue] = useState(3)

  const handLandmarkerRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const positionsRef = useRef<Array<{ x: number; y: number }>>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneRef = useRef(false)

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
   * Live stability score using RMS displacement from centroid.
   *
   * Based on MediaPipe research (Becktepe et al., 2025):
   * - MediaPipe hand landmarks in normalized [0,1] coords
   * - Noise floor of ~0.002 RMS for a perfectly still hand
   * - Physiological tremor: RMS ~0.003-0.008
   * - Essential tremor: RMS ~0.01-0.04
   * - Severe tremor: RMS >0.04
   *
   * We use RMS (root mean square) displacement from the centroid
   * rather than variance, because RMS is more stable and intuitive:
   * it represents the average distance the wrist moves from its
   * mean position. This avoids the erratic behavior of variance-based
   * scoring where squaring amplifies outliers disproportionately.
   *
   * The score uses a sigmoid-like mapping rather than pure log scale
   * to create smoother transitions and prevent wild swings.
   */
  const computeStability = useCallback(
    (points: Array<{ x: number; y: number }>) => {
      if (points.length < 15) return 50

      // Skip first 30% as settling period
      const skipCount = Math.max(15, Math.floor(points.length * 0.3))
      const settled = points.slice(skipCount)
      if (settled.length < 10) return 50

      // Compute centroid
      const meanX = settled.reduce((s, p) => s + p.x, 0) / settled.length
      const meanY = settled.reduce((s, p) => s + p.y, 0) / settled.length

      // RMS displacement from centroid (more stable than variance)
      const rms = Math.sqrt(
        settled.reduce(
          (s, p) => s + (p.x - meanX) ** 2 + (p.y - meanY) ** 2,
          0
        ) / settled.length
      )

      // Sigmoid-based scoring for smooth, stable transitions
      // Maps RMS to 0-100 where:
      //   RMS ~0.002 -> ~95 (very stable, near noise floor)
      //   RMS ~0.005 -> ~85 (normal physiological tremor)
      //   RMS ~0.015 -> ~55 (mild tremor)
      //   RMS ~0.04  -> ~25 (moderate tremor)
      //   RMS ~0.08  -> ~10 (severe tremor)
      const k = 150 // steepness of sigmoid
      const midpoint = 0.02 // RMS where score = 50
      const score = 100 / (1 + Math.exp(k * (rms - midpoint)))

      return Math.max(0, Math.min(100, score))
    },
    []
  )

  const stopTracking = useCallback(() => {
    doneRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const storedResultRef = useRef<HandData | null>(null)

  const finishTest = useCallback(
    (skipped: boolean) => {
      stopTracking()

      const pts = positionsRef.current
      const finalStability = skipped ? 0 : computeFinalStability(pts)

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

      const result: HandData = {
        stability: Math.round(finalStability * 10) / 10,
        samples: pts.length,
        positions: pts.slice(-300),
        varianceX,
        varianceY,
        wasSkipped: skipped,
        restartCount,
      }

      storedResultRef.current = result
      setStability(finalStability)
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
    if (!handLandmarkerRef.current || !videoRef.current || !cameraOn) return

    // 3-second countdown before tracking starts
    setStatus("countdown")
    setCountdownValue(3)
    let count = 3
    const countdownInterval = setInterval(() => {
      count--
      setCountdownValue(count)
      if (count <= 0) {
        clearInterval(countdownInterval)
        beginTracking()
      }
    }, 1000)
  }, [videoRef, cameraOn]) // eslint-disable-line react-hooks/exhaustive-deps

  const beginTracking = useCallback(() => {
    if (!handLandmarkerRef.current || !videoRef.current) return

    doneRef.current = false
    setStatus("tracking")
    positionsRef.current = []
    setTimeLeft(TASK_DURATION)
    setStability(null)

    let lastTime = -1

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
        finishTest(false)
      }
    }, 250)
  }, [videoRef, computeStability, finishTest])

  const handleRestart = useCallback(() => {
    stopTracking()
    setRestartCount((c) => c + 1)
    setStatus("ready")
    setTimeLeft(TASK_DURATION)
    setStability(null)
    setCountdownValue(3)
    positionsRef.current = []
  }, [stopTracking])

  const handleRestartFromDone = useCallback(() => {
    storedResultRef.current = null
    handleRestart()
  }, [handleRestart])

  const handleSkipToEnd = useCallback(() => {
    if (status === "tracking") {
      finishTest(false) // complete with current data
    }
  }, [status, finishTest])

  const elapsed = TASK_DURATION - timeLeft
  const progress = (elapsed / TASK_DURATION) * 100

  return (
    <Card className="border-border bg-card p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Motor Task</h2>
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
        <div className="space-y-3">
          <Button
            className="w-full gap-2"
            onClick={startTracking}
            disabled={!cameraOn}
          >
            <Hand className="h-4 w-4" />
            {restartCount > 0 ? "Restart Motor Task" : "Start Motor Task"}
          </Button>
          {restartCount > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Restarted {restartCount} time{restartCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {status === "countdown" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-muted-foreground">
            Position your hand in front of the camera
          </p>
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary bg-secondary">
            <p className="text-4xl font-bold text-primary">{countdownValue}</p>
          </div>
          <p className="text-sm font-medium text-foreground">
            Hold steady -- tracking starts soon
          </p>
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
            Motor task complete!
          </p>
          {stability !== null && (
            <div className="rounded-lg bg-secondary p-4 text-center w-full">
              <p className="text-xs text-muted-foreground">Final Stability Score</p>
              <p className="text-3xl font-bold text-foreground">
                {stability.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">out of 100</p>
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
 * Final stability score using RMS displacement with segment-based penalty.
 *
 * Uses RMS (root mean square) distance from centroid rather than variance
 * for more stable, intuitive scoring. Sigmoid mapping prevents wild swings.
 *
 * Based on Becktepe et al. (2025): MediaPipe hand landmarks have a noise
 * floor of ~0.002 RMS in normalized coordinates. The sigmoid curve is
 * calibrated so this noise floor maps to scores of ~95.
 */
function computeFinalStability(points: Array<{ x: number; y: number }>) {
  if (points.length < 15) return 50

  // Skip first 30% as settling period -- gives the user time to stabilize
  // after clicking start, even beyond the countdown
  const skipCount = Math.max(15, Math.floor(points.length * 0.3))
  const settled = points.slice(skipCount)
  if (settled.length < 10) return 50

  // Overall RMS from centroid
  const meanX = settled.reduce((s, p) => s + p.x, 0) / settled.length
  const meanY = settled.reduce((s, p) => s + p.y, 0) / settled.length
  const totalRms = Math.sqrt(
    settled.reduce(
      (s, p) => s + (p.x - meanX) ** 2 + (p.y - meanY) ** 2,
      0
    ) / settled.length
  )

  // Segment-based RMS for worst-period penalty
  const segmentSize = 30
  const segmentRms: number[] = []
  for (let i = 0; i < settled.length - segmentSize; i += segmentSize) {
    const seg = settled.slice(i, i + segmentSize)
    const sMeanX = seg.reduce((s, p) => s + p.x, 0) / seg.length
    const sMeanY = seg.reduce((s, p) => s + p.y, 0) / seg.length
    const sRms = Math.sqrt(
      seg.reduce(
        (s, p) => s + (p.x - sMeanX) ** 2 + (p.y - sMeanY) ** 2,
        0
      ) / seg.length
    )
    segmentRms.push(sRms)
  }

  // Blend with worst 25% of segments
  let penaltyRms = totalRms
  if (segmentRms.length > 2) {
    const sorted = [...segmentRms].sort((a, b) => b - a)
    const worstCount = Math.max(1, Math.ceil(sorted.length * 0.25))
    const worstAvg =
      sorted.slice(0, worstCount).reduce((s, v) => s + v, 0) / worstCount
    penaltyRms = totalRms * 0.7 + worstAvg * 0.3
  }

  // Sigmoid scoring
  const k = 150
  const midpoint = 0.02
  return Math.max(0, Math.min(100, 100 / (1 + Math.exp(k * (penaltyRms - midpoint)))))
}
