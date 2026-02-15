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
  AlertTriangle,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { HandData } from "./assessment-flow"

/**
 * Luria Fist–Edge–Palm (motor sequencing)
 *
 * IMPORTANT: "PALM" step here means PALM DOWN on a surface (fingers extended),
 * not "palm facing camera".
 */

const TASK_DURATION = 15
const TARGET_CYCLES = 3

const DEBOUNCE_FRAMES_DEFAULT = 6
const DEBOUNCE_FRAMES_PALM = 6
const COOLDOWN_MS = 250

const IDEAL_STEP_TIME_MS_MIN = 450
const IDEAL_STEP_TIME_MS_MAX = 1600
const STUCK_THRESHOLD_MS = 2200

// Orientation thresholds (tune if needed)
const EDGE_NX_MIN = 0.55
const PALM_NY_MIN = 0.55
const DOMINANCE_MARGIN = 0.08

interface HandTrackingProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  cameraOn: boolean
  onComplete: (data: HandData) => void
  onSkip: () => void
  mirrored?: boolean
  overlayCanvasRef?: React.RefObject<HTMLCanvasElement | null>
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

type Pt = { x: number; y: number }
type MPPoint = { x: number; y: number; z?: number }
type Pose = "FIST" | "EDGE" | "PALM" | "UNKNOWN"

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function maybeMirrorX(x: number, mirrored: boolean) {
  return mirrored ? 1 - x : x
}

function mean(arr: number[]) {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function variance(arr: number[]) {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length
}

function median(arr: number[]) {
  if (!arr.length) return 0
  const a = [...arr].sort((x, y) => x - y)
  const mid = Math.floor(a.length / 2)
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function poseLabel(p: Pose) {
  switch (p) {
    case "FIST":
      return "Fist ✊"
    case "EDGE":
      return "Edge ✋ (karate chop)"
    case "PALM":
      return "Palm DOWN 🖐️⬇️"
    default:
      return "…"
  }
}

function nextPose(p: Exclude<Pose, "UNKNOWN">): Exclude<Pose, "UNKNOWN"> {
  if (p === "FIST") return "EDGE"
  if (p === "EDGE") return "PALM"
  return "FIST"
}

/**
 * IMPORTANT FIX FOR LANDMARKERS:
 * - Canvas MUST be resized BEFORE clearing
 * - MUST use video.videoWidth/video.videoHeight (not 640/480 fallback)
 * - Do not attempt to draw until video has real dimensions
 */
function drawHandOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  landmarks: Array<{ x: number; y: number }>,
  width: number,
  height: number
) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const connections: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [0, 9],
    [9, 10],
    [10, 11],
    [11, 12],
    [0, 13],
    [13, 14],
    [14, 15],
    [15, 16],
    [0, 17],
    [17, 18],
    [18, 19],
    [19, 20],
    [5, 9],
    [9, 13],
    [13, 17],
  ]

  ctx.lineWidth = 2
  ctx.strokeStyle = "rgba(34, 197, 94, 0.9)"
  ctx.beginPath()
  for (const [a, b] of connections) {
    const pa = landmarks[a]
    const pb = landmarks[b]
    if (!pa || !pb) continue
    ctx.moveTo(pa.x * width, pa.y * height)
    ctx.lineTo(pb.x * width, pb.y * height)
  }
  ctx.stroke()

  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i]
    const x = p.x * width
    const y = p.y * height
    const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20
    const r = isTip ? 5 : 3
    ctx.fillStyle = isTip
      ? "rgba(59, 130, 246, 0.95)"
      : "rgba(255, 255, 255, 0.9)"
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function palmNormalRatios(lm: MPPoint[], mirrored: boolean) {
  const z0 = lm[0].z
  const z5 = lm[5].z
  const z17 = lm[17].z
  if (
    typeof z0 !== "number" ||
    typeof z5 !== "number" ||
    typeof z17 !== "number"
  ) {
    return null
  }

  const p0 = { x: maybeMirrorX(lm[0].x, mirrored), y: lm[0].y, z: z0 }
  const p5 = { x: maybeMirrorX(lm[5].x, mirrored), y: lm[5].y, z: z5 }
  const p17 = { x: maybeMirrorX(lm[17].x, mirrored), y: lm[17].y, z: z17 }

  const v1 = { x: p5.x - p0.x, y: p5.y - p0.y, z: p5.z - p0.z }
  const v2 = { x: p17.x - p0.x, y: p17.y - p0.y, z: p17.z - p0.z }

  const nx = v1.y * v2.z - v1.z * v2.y
  const ny = v1.z * v2.x - v1.x * v2.z
  const nz = v1.x * v2.y - v1.y * v2.x

  const norm = Math.hypot(nx, ny, nz)
  if (norm < 1e-6) return null

  return {
    nxRatio: Math.abs(nx) / norm,
    nyRatio: Math.abs(ny) / norm,
    nzRatio: Math.abs(nz) / norm,
  }
}

function classifyPose(lm: MPPoint[], mirrored: boolean): Pose {
  if (!lm || lm.length < 21) return "UNKNOWN"

  const wrist2: Pt = { x: maybeMirrorX(lm[0].x, mirrored), y: lm[0].y }
  const indexMcp2: Pt = { x: maybeMirrorX(lm[5].x, mirrored), y: lm[5].y }
  const middleMcp2: Pt = { x: maybeMirrorX(lm[9].x, mirrored), y: lm[9].y }
  const ringMcp2: Pt = { x: maybeMirrorX(lm[13].x, mirrored), y: lm[13].y }
  const pinkyMcp2: Pt = { x: maybeMirrorX(lm[17].x, mirrored), y: lm[17].y }

  const palmSize = Math.max(dist(wrist2, middleMcp2), 1e-4)
  const palmWidth2D = dist(indexMcp2, pinkyMcp2) / palmSize

  const fingerExtended = (mcpIdx: number, pipIdx: number, tipIdx: number) => {
    const mcp: Pt = { x: maybeMirrorX(lm[mcpIdx].x, mirrored), y: lm[mcpIdx].y }
    const pip: Pt = { x: maybeMirrorX(lm[pipIdx].x, mirrored), y: lm[pipIdx].y }
    const tip: Pt = { x: maybeMirrorX(lm[tipIdx].x, mirrored), y: lm[tipIdx].y }

    const dTip = dist(tip, mcp)
    const dPip = dist(pip, mcp)
    return dTip > dPip + 0.12 * palmSize
  }

  const thumbExtended = (() => {
    const mcp: Pt = { x: maybeMirrorX(lm[2].x, mirrored), y: lm[2].y }
    const ip: Pt = { x: maybeMirrorX(lm[3].x, mirrored), y: lm[3].y }
    const tip: Pt = { x: maybeMirrorX(lm[4].x, mirrored), y: lm[4].y }
    const dTip = dist(tip, mcp)
    const dIp = dist(ip, mcp)
    return dTip > dIp + 0.1 * palmSize
  })()

  const indexExt = fingerExtended(5, 6, 8)
  const middleExt = fingerExtended(9, 10, 12)
  const ringExt = fingerExtended(13, 14, 16)
  const pinkyExt = fingerExtended(17, 18, 20)

  const extCount =
    (thumbExtended ? 1 : 0) +
    (indexExt ? 1 : 0) +
    (middleExt ? 1 : 0) +
    (ringExt ? 1 : 0) +
    (pinkyExt ? 1 : 0)

  const palmCenter: Pt = {
    x: (wrist2.x + indexMcp2.x + middleMcp2.x + ringMcp2.x + pinkyMcp2.x) / 5,
    y: (wrist2.y + indexMcp2.y + middleMcp2.y + ringMcp2.y + pinkyMcp2.y) / 5,
  }
  const tips: Pt[] = [
    { x: maybeMirrorX(lm[4].x, mirrored), y: lm[4].y },
    { x: maybeMirrorX(lm[8].x, mirrored), y: lm[8].y },
    { x: maybeMirrorX(lm[12].x, mirrored), y: lm[12].y },
    { x: maybeMirrorX(lm[16].x, mirrored), y: lm[16].y },
    { x: maybeMirrorX(lm[20].x, mirrored), y: lm[20].y },
  ]
  const meanTipToCenter = mean(tips.map((t) => dist(t, palmCenter))) / palmSize
  if (extCount <= 1 && meanTipToCenter < 0.85) return "FIST"

  if (extCount < 3) return "UNKNOWN"

  const ratios = palmNormalRatios(lm, mirrored)
  if (ratios) {
    const { nxRatio, nyRatio, nzRatio } = ratios

    const edge =
      nxRatio >= EDGE_NX_MIN &&
      nxRatio > nyRatio + DOMINANCE_MARGIN &&
      nxRatio > nzRatio + DOMINANCE_MARGIN

    const palmDown =
      nyRatio >= PALM_NY_MIN &&
      nyRatio > nxRatio + DOMINANCE_MARGIN &&
      nyRatio > nzRatio + DOMINANCE_MARGIN &&
      extCount >= 4

    if (edge) return "EDGE"
    if (palmDown) return "PALM"

    return palmWidth2D >= 0.72 && extCount >= 4 ? "PALM" : "EDGE"
  }

  if (palmWidth2D >= 0.75 && extCount >= 4) return "PALM"
  if (palmWidth2D <= 0.7) return "EDGE"
  return "UNKNOWN"
}

function speedScoreFromTransitionTimes(timesMs: number[]) {
  if (timesMs.length < 2) return 50
  const t = median(timesMs)

  if (t >= IDEAL_STEP_TIME_MS_MIN && t <= IDEAL_STEP_TIME_MS_MAX) return 100

  if (t < IDEAL_STEP_TIME_MS_MIN) {
    const ratio = t / IDEAL_STEP_TIME_MS_MIN
    return clamp(40 + 60 * ratio, 0, 100)
  }

  const over = t - IDEAL_STEP_TIME_MS_MAX
  const span = 1800
  const drop = (over / span) * 70
  return clamp(100 - drop, 0, 100)
}

function perseverationPenalty(stuckEvents: number) {
  return clamp(stuckEvents * 8, 0, 30)
}

export function HandTracking({
  videoRef,
  cameraOn,
  onComplete,
  onSkip,
  mirrored = true,
  overlayCanvasRef,
}: HandTrackingProps) {
  const [status, setStatus] = useState<
    "loading" | "ready" | "countdown" | "tracking" | "done"
  >("loading")
  const [timeLeft, setTimeLeft] = useState(TASK_DURATION)
  const [restartCount, setRestartCount] = useState(0)
  const [countdownValue, setCountdownValue] = useState(3)

  const [sequenceScore, setSequenceScore] = useState<number | null>(null)
  const [trackingHint, setTrackingHint] = useState<string | null>(null)
  const [livePose, setLivePose] = useState<Pose>("UNKNOWN")
  const [expectedPose, setExpectedPose] =
    useState<Exclude<Pose, "UNKNOWN">>("FIST")
  const [cyclesDone, setCyclesDone] = useState<number>(0)

  const expectedPoseRef = useRef<Exclude<Pose, "UNKNOWN">>("FIST")

  const handLandmarkerRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneRef = useRef(false)

  const wristPositionsRef = useRef<Pt[]>([])
  const totalFramesRef = useRef<number>(0)
  const detectedFramesRef = useRef<number>(0)

  const acceptedPoseRef = useRef<Pose>("UNKNOWN")
  const stablePoseRef = useRef<Pose>("UNKNOWN")
  const stableCountRef = useRef<number>(0)
  const lastAcceptTsRef = useRef<number>(0)

  const correctStepsRef = useRef<number>(0)
  const incorrectStepsRef = useRef<number>(0)
  const cyclesRef = useRef<number>(0)

  const correctTransitionTimesRef = useRef<number[]>([])
  const lastCorrectAcceptTsRef = useRef<number | null>(null)

  const lastAcceptedPoseStartTsRef = useRef<number | null>(null)
  const stuckEventsRef = useRef<number>(0)

  const storedResultRef = useRef<HandData | null>(null)

  const clearOverlay = useCallback(() => {
    const canvas = overlayCanvasRef?.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [overlayCanvasRef])

  const setExpected = useCallback((p: Exclude<Pose, "UNKNOWN">) => {
    expectedPoseRef.current = p
    setExpectedPose(p)
  }, [])

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
      doneRef.current = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
      clearOverlay()
      handLandmarkerRef.current?.close?.()
    }
  }, [clearOverlay])

  const stopTracking = useCallback(() => {
    doneRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    clearOverlay()
  }, [clearOverlay])

  const computeLiveCompositeScore = useCallback(() => {
    const c = correctStepsRef.current
    const w = incorrectStepsRef.current
    const total = c + w

    const accuracy = total > 0 ? c / total : 0.5
    const completion = clamp(cyclesRef.current / TARGET_CYCLES, 0, 1)
    const speedScore = speedScoreFromTransitionTimes(
      correctTransitionTimesRef.current
    )
    const penalty = perseverationPenalty(stuckEventsRef.current)

    const composite =
      100 * (0.55 * accuracy + 0.3 * completion + 0.15 * (speedScore / 100)) -
      penalty

    return clamp(composite, 0, 100)
  }, [])

  const finishTest = useCallback(
    (skipped: boolean) => {
      stopTracking()

      const pts = wristPositionsRef.current
      const xs = pts.map((p) => p.x)
      const ys = pts.map((p) => p.y)
      const varianceX = variance(xs)
      const varianceY = variance(ys)

      const coverage =
        detectedFramesRef.current / Math.max(1, totalFramesRef.current)
      const covFactor = clamp((coverage - 0.5) / 0.5, 0, 1)

      const base = computeLiveCompositeScore()
      const final = skipped
        ? 0
        : clamp(base * (0.75 + 0.25 * covFactor), 0, 100)

      const result = {
        stability: Math.round(final * 10) / 10,
        samples: pts.length,
        positions: pts.slice(-300),
        varianceX,
        varianceY,
        wasSkipped: skipped,
        restartCount,
      } as unknown as HandData

      storedResultRef.current = result
      setSequenceScore(final)
      setStatus("done")
    },
    [stopTracking, computeLiveCompositeScore, restartCount]
  )

  const handleContinue = useCallback(() => {
    if (storedResultRef.current) {
      onComplete(storedResultRef.current)
    }
  }, [onComplete])

  const startTracking = useCallback(() => {
    if (!handLandmarkerRef.current || !videoRef.current || !cameraOn) return

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
    if (!handLandmarkerRef.current || !videoRef.current || !cameraOn) return

    doneRef.current = false
    setStatus("tracking")
    setTrackingHint(null)
    setTimeLeft(TASK_DURATION)

    setLivePose("UNKNOWN")
    setExpected("FIST")
    setCyclesDone(0)
    setSequenceScore(null)

    wristPositionsRef.current = []
    totalFramesRef.current = 0
    detectedFramesRef.current = 0

    acceptedPoseRef.current = "UNKNOWN"
    stablePoseRef.current = "UNKNOWN"
    stableCountRef.current = 0
    lastAcceptTsRef.current = 0

    correctStepsRef.current = 0
    incorrectStepsRef.current = 0
    cyclesRef.current = 0

    correctTransitionTimesRef.current = []
    lastCorrectAcceptTsRef.current = null

    lastAcceptedPoseStartTsRef.current = null
    stuckEventsRef.current = 0

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

      totalFramesRef.current += 1

      try {
        const results = suppressMediaPipeInfo(() =>
          landmarker.detectForVideo(video, now)
        )

        const hasHand = results?.landmarks?.length > 0
        if (!hasHand) {
          if (totalFramesRef.current % 30 === 0) {
            setTrackingHint(
              "No hand detected — move your hand closer and center it."
            )
          }
          setLivePose("UNKNOWN")
          clearOverlay()
          rafRef.current = requestAnimationFrame(processFrame)
          return
        }

        detectedFramesRef.current += 1
        setTrackingHint(null)

        const lm: MPPoint[] = results.landmarks[0]

        // ✅ FIX: don't draw until video has real dimensions (no 640/480 fallback)
        const canvas = overlayCanvasRef?.current
        if (canvas) {
          const ctx = canvas.getContext("2d")
          const w = video.videoWidth
          const h = video.videoHeight
          if (ctx && w && h) {
            drawHandOverlay(
              ctx,
              canvas,
              lm.map((p) => ({ x: p.x, y: p.y })),
              w,
              h
            )
          }
        }

        const wrist = lm[0]
        wristPositionsRef.current.push({
          x: maybeMirrorX(wrist.x, mirrored),
          y: wrist.y,
        })

        const lastStart = lastAcceptedPoseStartTsRef.current
        if (acceptedPoseRef.current !== "UNKNOWN" && lastStart != null) {
          const dwell = now - lastStart
          if (dwell > STUCK_THRESHOLD_MS) {
            stuckEventsRef.current += 1
            lastAcceptedPoseStartTsRef.current = now
          }
        }

        const pose: Pose = classifyPose(lm, mirrored)
        setLivePose(pose)

        if (pose === "UNKNOWN") {
          stablePoseRef.current = "UNKNOWN"
          stableCountRef.current = 0
          rafRef.current = requestAnimationFrame(processFrame)
          return
        }

        if (pose === stablePoseRef.current) {
          stableCountRef.current += 1
        } else {
          stablePoseRef.current = pose
          stableCountRef.current = 1
        }

        const debounceFrames =
          pose === "PALM" ? DEBOUNCE_FRAMES_PALM : DEBOUNCE_FRAMES_DEFAULT
        const canAccept = now - lastAcceptTsRef.current > COOLDOWN_MS

        if (
          stableCountRef.current >= debounceFrames &&
          canAccept &&
          pose !== acceptedPoseRef.current
        ) {
          acceptedPoseRef.current = pose
          lastAcceptTsRef.current = now
          lastAcceptedPoseStartTsRef.current = now

          const expectedNow = expectedPoseRef.current

          if (pose === expectedNow) {
            if (lastCorrectAcceptTsRef.current != null) {
              const dt = now - lastCorrectAcceptTsRef.current
              correctTransitionTimesRef.current.push(dt)
              correctTransitionTimesRef.current =
                correctTransitionTimesRef.current.slice(-30)
            }
            lastCorrectAcceptTsRef.current = now

            correctStepsRef.current += 1

            const nxt = nextPose(expectedNow)
            setExpected(nxt)

            if (expectedNow === "PALM") {
              cyclesRef.current += 1
              setCyclesDone(cyclesRef.current)

              if (cyclesRef.current >= TARGET_CYCLES) {
                finishTest(false)
                return
              }
            }
          } else {
            incorrectStepsRef.current += 1
          }

          setSequenceScore(computeLiveCompositeScore())
        }
      } catch {
        // ignore
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
  }, [
    cameraOn,
    videoRef,
    mirrored,
    overlayCanvasRef,
    clearOverlay,
    setExpected,
    computeLiveCompositeScore,
    finishTest,
  ])

  const handleRestart = useCallback(() => {
    stopTracking()
    storedResultRef.current = null
    setRestartCount((c) => c + 1)
    setStatus("ready")
    setTimeLeft(TASK_DURATION)
    setCountdownValue(3)
    setSequenceScore(null)
    setTrackingHint(null)
    setLivePose("UNKNOWN")
    setExpected("FIST")
    setCyclesDone(0)
    clearOverlay()

    wristPositionsRef.current = []
    totalFramesRef.current = 0
    detectedFramesRef.current = 0
  }, [stopTracking, clearOverlay])

  const handleSkipToEnd = useCallback(() => {
    if (status === "tracking") {
      finishTest(false)
    }
  }, [status, finishTest])

  const handleSkip = useCallback(() => {
    finishTest(true)
    onSkip()
  }, [finishTest, onSkip])

  const handleRestartFromDone = useCallback(() => {
    storedResultRef.current = null
    handleRestart()
  }, [handleRestart])

  const elapsed = TASK_DURATION - timeLeft
  const progress = (elapsed / TASK_DURATION) * 100

  const correctSteps = correctStepsRef.current
  const incorrectSteps = incorrectStepsRef.current
  const totalAccepted = correctSteps + incorrectSteps
  const accuracy = totalAccepted
    ? Math.round((correctSteps / totalAccepted) * 100)
    : 0
  const medStepMs = median(correctTransitionTimesRef.current)
  const medStepLabel =
    correctTransitionTimesRef.current.length >= 2
      ? `${Math.round(medStepMs)}ms`
      : "—"

  return (
    <Card className="border-border bg-card p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Motor Task</h2>
        {status === "ready" ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={handleSkip}
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip Test
          </Button>
        ) : null}
      </div>

      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        Perform the Luria sequence with your right hand:
        <br />
        <span className="font-medium">
          Fist → Edge (karate chop) → Palm DOWN
        </span>
        <br />
        <span className="text-xs">
          Palm step = place your hand flat with fingers extended (palm down on
          table).
        </span>
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
            Tracking starts soon
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

          {trackingHint && (
            <div className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span>{trackingHint}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-secondary p-4 text-center">
              <p className="text-xs text-muted-foreground">Detected pose</p>
              <p className="text-lg font-bold text-foreground">
                {poseLabel(livePose)}
              </p>
            </div>

            <div className="rounded-lg bg-secondary p-4 text-center">
              <p className="text-xs text-muted-foreground">Next expected</p>
              <p className="text-lg font-bold text-foreground">
                {poseLabel(expectedPose)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-secondary p-3 text-center">
              <p className="text-[11px] text-muted-foreground">Cycles</p>
              <p className="text-base font-semibold text-foreground">
                {cyclesDone}/{TARGET_CYCLES}
              </p>
            </div>
            <div className="rounded-lg bg-secondary p-3 text-center">
              <p className="text-[11px] text-muted-foreground">Accuracy</p>
              <p className="text-base font-semibold text-foreground">
                {accuracy}%
              </p>
            </div>
            <div className="rounded-lg bg-secondary p-3 text-center">
              <p className="text-[11px] text-muted-foreground">Median step</p>
              <p className="text-base font-semibold text-foreground">
                {medStepLabel}
              </p>
            </div>
          </div>

          {sequenceScore !== null && (
            <div className="rounded-lg bg-secondary p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Live Sequencing Score
              </p>
              <p className="text-3xl font-bold text-foreground">
                {sequenceScore.toFixed(1)}
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

          {sequenceScore !== null && (
            <div className="rounded-lg bg-secondary p-4 text-center w-full">
              <p className="text-xs text-muted-foreground">
                Final Sequencing Score
              </p>
              <p className="text-3xl font-bold text-foreground">
                {sequenceScore.toFixed(1)}
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
