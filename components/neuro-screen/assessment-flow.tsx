"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { SpeechTask } from "./speech-task"
import { HandTracking } from "./hand-tracking"
import { EyeTracking } from "./eye-tracking"
import { ResultsDashboard } from "./results-dashboard"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Camera, CameraOff, Activity, Brain } from "lucide-react"

export interface AssessmentResults {
  speech: { duration: number; fileSize: number } | null
  hand: { stability: number; samples: number } | null
  eye: { smoothness: number; samples: number } | null
}

const STEPS = [
  { label: "Welcome", description: "Camera setup and instructions" },
  { label: "Speech", description: "Verbal fluency assessment" },
  { label: "Motor", description: "Hand stability tracking" },
  { label: "Eyes", description: "Eye movement tracking" },
  { label: "Results", description: "Assessment summary" },
]

export function AssessmentFlow() {
  const [step, setStep] = useState(0)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [results, setResults] = useState<AssessmentResults>({
    speech: null,
    hand: null,
    eye: null,
  })

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

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
    (data: { duration: number; fileSize: number }) => {
      setResults((prev) => ({ ...prev, speech: data }))
      handleNext()
    },
    [handleNext]
  )

  const handleHandComplete = useCallback(
    (data: { stability: number; samples: number }) => {
      setResults((prev) => ({ ...prev, hand: data }))
      handleNext()
    },
    [handleNext]
  )

  const handleEyeComplete = useCallback(
    (data: { smoothness: number; samples: number }) => {
      setResults((prev) => ({ ...prev, eye: data }))
      handleNext()
    },
    [handleNext]
  )

  const handleRestart = useCallback(() => {
    setStep(0)
    setResults({ speech: null, hand: null, eye: null })
    if (!cameraOn) {
      startCamera()
    }
  }, [cameraOn, startCamera])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Neuro Screen</h1>
            <p className="text-xs text-muted-foreground">Cognitive Assessment Tool</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="hidden items-center gap-1 md:flex">
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

        {/* Camera toggle */}
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
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center gap-6 p-6">
        {/* Video container - always rendered, fixed size */}
        {step < 4 && (
          <Card className="relative w-full max-w-[640px] overflow-hidden border-border bg-card">
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
                  <CameraOff className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Camera is off</p>
                  <Button size="sm" onClick={startCamera}>
                    Turn On Camera
                  </Button>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-secondary">
                  <CameraOff className="h-12 w-12 text-destructive" />
                  <p className="max-w-xs text-center text-sm text-destructive">
                    {cameraError}
                  </p>
                </div>
              )}
              {/* Step indicator overlay */}
              {cameraOn && step > 0 && step < 4 && (
                <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 backdrop-blur-sm">
                  <Activity className="h-3.5 w-3.5 text-accent" />
                  <span className="text-xs font-medium text-foreground">
                    {STEPS[step].label} Task Active
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Task content */}
        <div className="w-full max-w-[640px]">
          {step === 0 && (
            <Card className="border-border bg-card p-6">
              <h2 className="mb-2 text-xl font-semibold text-foreground">
                Welcome to Neuro Screen
              </h2>
              <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                This tool performs a quick cognitive screening through three
                short tasks: a verbal fluency test, a hand stability assessment,
                and an eye movement tracking exercise. Make sure your camera is
                on and you are in a well-lit environment.
              </p>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Speech Task: Say as many words as possible starting with a letter
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Motor Task: Hold your hand steady in front of the camera
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Eye Task: Follow the dot with your eyes
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
          )}

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

          {step === 4 && (
            <ResultsDashboard results={results} onRestart={handleRestart} />
          )}
        </div>
      </main>
    </div>
  )
}
