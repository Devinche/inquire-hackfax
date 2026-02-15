"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { SpeechTask } from "./speech-task"
import { HandTracking } from "./hand-tracking"
import { EyeTracking } from "./eye-tracking"
import { ResultsDashboard } from "./results-dashboard"
import { AssessmentHistory } from "./assessment-history"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Camera,
  CameraOff,
  Activity,
  Brain,
  History,
  ChevronLeft,
} from "lucide-react"

export interface SpeechData {
  duration: number
  words: string[]
  letter: string
}

export interface HandData {
  stability: number
  samples: number
  positions: Array<{ x: number; y: number }>
  varianceX: number
  varianceY: number
}

export interface EyeData {
  smoothness: number
  samples: number
  deltas: number[]
  meanDelta: number
  maxDelta: number
}

export interface AssessmentResults {
  speech: SpeechData | null
  hand: HandData | null
  eye: EyeData | null
}

export interface StoredAssessment {
  id: string
  timestamp: number
  results: AssessmentResults
}

const STEPS = [
  { label: "Welcome", description: "Camera setup and instructions" },
  { label: "Speech", description: "Verbal fluency assessment" },
  { label: "Motor", description: "Hand stability tracking" },
  { label: "Eyes", description: "Eye movement tracking" },
  { label: "Results", description: "Assessment summary" },
]

function loadHistory(): StoredAssessment[] {
  try {
    const stored = localStorage.getItem("neuro-screen-history")
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveHistory(history: StoredAssessment[]) {
  try {
    localStorage.setItem("neuro-screen-history", JSON.stringify(history))
  } catch {
    // storage full or unavailable
  }
}

export function AssessmentFlow() {
  const [step, setStep] = useState(0)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [results, setResults] = useState<AssessmentResults>({
    speech: null,
    hand: null,
    eye: null,
  })
  const [view, setView] = useState<"assessment" | "history">("assessment")
  const [history, setHistory] = useState<StoredAssessment[]>([])
  const [selectedReport, setSelectedReport] = useState<StoredAssessment | null>(
    null
  )

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
    } catch (err) {
      console.error("Cannot access camera:", err)
      setCameraError("Camera access denied. Please allow camera permissions.")
      setCameraOn(false)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraOn(false)
  }, [])

  const toggleCamera = useCallback(() => {
    if (cameraOn) {
      stopCamera()
    } else {
      startCamera()
    }
  }, [cameraOn, startCamera, stopCamera])

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleNext = useCallback(() => {
    setStep((prev) => prev + 1)
  }, [])

  const handleSpeechComplete = useCallback(
    (data: SpeechData) => {
      setResults((prev) => ({ ...prev, speech: data }))
      handleNext()
    },
    [handleNext]
  )

  const handleHandComplete = useCallback(
    (data: HandData) => {
      setResults((prev) => ({ ...prev, hand: data }))
      handleNext()
    },
    [handleNext]
  )

  const handleEyeComplete = useCallback(
    (data: EyeData) => {
      setResults((prev) => ({ ...prev, eye: data }))
      // Save to history when all tasks done
      const finalResults = { ...results, eye: data }
      const assessment: StoredAssessment = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        results: finalResults,
      }
      const newHistory = [assessment, ...history]
      setHistory(newHistory)
      saveHistory(newHistory)
      handleNext()
    },
    [handleNext, results, history]
  )

  const handleRestart = useCallback(() => {
    setStep(0)
    setResults({ speech: null, hand: null, eye: null })
    setView("assessment")
    setSelectedReport(null)
    if (!cameraOn) {
      startCamera()
    }
  }, [cameraOn, startCamera])

  const handleViewReport = useCallback((assessment: StoredAssessment) => {
    setSelectedReport(assessment)
    setView("assessment")
    setStep(4)
  }, [])

  const handleDeleteAssessment = useCallback(
    (id: string) => {
      const newHistory = history.filter((a) => a.id !== id)
      setHistory(newHistory)
      saveHistory(newHistory)
      if (selectedReport?.id === id) {
        setSelectedReport(null)
        setView("history")
      }
    },
    [history, selectedReport]
  )

  const showCamera = step > 0 && step < 4 && view === "assessment"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Neuro Screen
            </h1>
            <p className="text-xs text-muted-foreground">
              Cognitive Assessment Tool
            </p>
          </div>
        </div>

        {/* Step indicators -- desktop only */}
        {view === "assessment" && (
          <div className="hidden items-center gap-1 lg:flex">
            {STEPS.map((s, i) => (
              <div key={s.label} className="flex items-center">
                <div
                  className={`flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors ${
                    i === step
                      ? "bg-primary text-primary-foreground"
                      : i < step
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-1 h-px w-4 ${i < step ? "bg-accent" : "bg-border"}`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* History toggle */}
          <Button
            variant={view === "history" ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => {
              if (view === "history") {
                setView("assessment")
                if (step < 4) setSelectedReport(null)
              } else {
                setView("history")
              }
            }}
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">
              History ({history.length})
            </span>
          </Button>

          {/* Camera toggle */}
          {view === "assessment" && step < 4 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleCamera}
              className="gap-2"
            >
              {cameraOn ? (
                <>
                  <Camera className="h-4 w-4" />
                  <span className="hidden sm:inline">Camera On</span>
                </>
              ) : (
                <>
                  <CameraOff className="h-4 w-4" />
                  <span className="hidden sm:inline">Camera Off</span>
                </>
              )}
            </Button>
          )}
        </div>
      </header>

      {/* History view */}
      {view === "history" && (
        <main className="flex flex-1 flex-col items-center p-4 sm:p-6">
          <div className="w-full max-w-4xl">
            <AssessmentHistory
              history={history}
              onViewReport={handleViewReport}
              onDelete={handleDeleteAssessment}
              onNewAssessment={handleRestart}
            />
          </div>
        </main>
      )}

      {/* Assessment view */}
      {view === "assessment" && (
        <main className="flex flex-1 flex-col items-center p-4 sm:p-6">
          {/* Side-by-side layout: camera + task on larger screens */}
          {showCamera ? (
            <div className="flex w-full max-w-5xl flex-col gap-4 lg:flex-row">
              {/* Camera */}
              <div className="w-full shrink-0 lg:w-[360px]">
                <Card className="sticky top-4 overflow-hidden border-border bg-card">
                  <div className="relative aspect-[4/3] w-full bg-secondary">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                    {!cameraOn && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-secondary">
                        <CameraOff className="h-10 w-10 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Camera is off
                        </p>
                        <Button size="sm" onClick={startCamera}>
                          Turn On Camera
                        </Button>
                      </div>
                    )}
                    {cameraError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-secondary">
                        <CameraOff className="h-10 w-10 text-destructive" />
                        <p className="max-w-xs text-center text-sm text-destructive">
                          {cameraError}
                        </p>
                      </div>
                    )}
                    {cameraOn && (
                      <div className="absolute left-2 top-2 flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 backdrop-blur-sm">
                        <Activity className="h-3 w-3 text-accent" />
                        <span className="text-xs font-medium text-foreground">
                          {STEPS[step].label}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Task content */}
              <div className="flex-1">
                {step === 1 && (
                  <SpeechTask onComplete={handleSpeechComplete} />
                )}
                {step === 2 && (
                  <HandTracking
                    videoRef={videoRef}
                    cameraOn={cameraOn}
                    onComplete={handleHandComplete}
                  />
                )}
                {step === 3 && (
                  <EyeTracking
                    videoRef={videoRef}
                    cameraOn={cameraOn}
                    onComplete={handleEyeComplete}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl">
              {/* Hidden video element for initial setup */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="hidden"
              />

              {step === 0 && (
                <div className="flex flex-col items-center gap-6">
                  {/* Camera preview for welcome */}
                  <Card className="w-full max-w-[480px] overflow-hidden border-border bg-card">
                    <div className="relative aspect-[4/3] w-full bg-secondary">
                      <video
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full object-cover"
                        style={{ transform: "scaleX(-1)" }}
                        ref={(el) => {
                          if (el && streamRef.current) {
                            el.srcObject = streamRef.current
                          }
                        }}
                      />
                      {!cameraOn && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-secondary">
                          <CameraOff className="h-12 w-12 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Camera is off
                          </p>
                          <Button size="sm" onClick={startCamera}>
                            Turn On Camera
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card className="w-full max-w-[480px] border-border bg-card p-6">
                    <h2 className="mb-2 text-xl font-semibold text-foreground text-balance">
                      Welcome to Neuro Screen
                    </h2>
                    <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                      This tool performs a quick cognitive screening through
                      three short tasks. Make sure your camera is on and you are
                      in a well-lit environment.
                    </p>
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Speech: Say words starting with a letter (60s)
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Motor: Hold your hand steady (15s)
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Eyes: Follow a moving dot (15s)
                      </div>
                    </div>
                    <Button
                      className="mt-6 w-full"
                      onClick={handleNext}
                      disabled={!cameraOn}
                    >
                      Begin Assessment
                    </Button>
                  </Card>
                </div>
              )}

              {step === 4 && (
                <div>
                  {selectedReport ? (
                    <div className="mb-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-muted-foreground"
                        onClick={() => {
                          setSelectedReport(null)
                          setView("history")
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Back to History
                      </Button>
                    </div>
                  ) : null}
                  <ResultsDashboard
                    results={selectedReport?.results ?? results}
                    onRestart={handleRestart}
                    allHistory={history}
                  />
                </div>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  )
}
