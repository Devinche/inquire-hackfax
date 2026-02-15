"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { SpeechTask } from "./speech-task"
import { HandTracking } from "./hand-tracking"
import { EyeTracking } from "./eye-tracking"
import { ResultsDashboard } from "./results-dashboard"
import { AssessmentHistory } from "./assessment-history"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PostResultsActions } from "./post-results-actions"
import { SendToDoctor } from "./send-to-doctor"
import {
  Activity,
  Brain,
  History,
  ChevronLeft,
  CameraOff,
} from "lucide-react"

export interface SpeechData {
  duration: number
  words: string[]
  letter: string
  repeatWords: Record<string, number> // word -> count of times repeated
  wasSkipped: boolean
  restartCount: number
}

export interface HandData {
  stability: number
  samples: number
  positions: Array<{ x: number; y: number }>
  varianceX: number
  varianceY: number
  wasSkipped: boolean
  restartCount: number
}

export interface EyeData {
  smoothness: number
  samples: number
  deltas: number[]
  meanDelta: number
  maxDelta: number
  gazeOnTarget: number // percentage of time gaze was on the dot
  wasSkipped: boolean
  restartCount: number
}

export interface AssessmentResults {
  speech: SpeechData | null
  hand: HandData | null
  eye: EyeData | null
  recordingUrl?: string // Blob URL of the video recording
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
    const stored = localStorage.getItem("inquire-history")
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveHistory(history: StoredAssessment[]) {
  try {
    localStorage.setItem("inquire-history", JSON.stringify(history))
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
    recordingUrl: undefined,
  })
  const [view, setView] = useState<"assessment" | "history">("assessment")
  const [history, setHistory] = useState<StoredAssessment[]>([])
  const [selectedReport, setSelectedReport] = useState<StoredAssessment | null>(
    null
  )

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  const startCamera = useCallback(async () => {
    // Prevent multiple simultaneous camera starts
    if (streamRef.current) {
      setCameraOn(true)
      return
    }
    
    try {
      setCameraError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      })
      streamRef.current = stream
      
      // Attach stream to video element if it exists
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((playError) => {
            if (playError instanceof Error && !playError.message.includes('interrupted')) {
              console.error("Video play error:", playError)
            }
          })
        }
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

  const startRecording = useCallback(() => {
    if (!streamRef.current) return
    
    try {
      recordedChunksRef.current = []
      
      // Try different codecs in order of preference
      let mimeType = 'video/webm;codecs=vp9'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8'
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm'
      }
      
      const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType })
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.start(100) // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder
    } catch (err) {
      console.error("Failed to start recording:", err)
    }
  }, [])

  const stopRecording = useCallback(() => {
    return new Promise<string | undefined>((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(undefined)
        return
      }
      
      const recorder = mediaRecorderRef.current
      
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        mediaRecorderRef.current = null
        recordedChunksRef.current = []
        resolve(url)
      }
      
      recorder.stop()
    })
  }, [])

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleNext = useCallback(() => {
    const next = step + 1
    setStep(next)
    
    // Start recording when entering first test (Speech)
    if (next === 1) {
      setTimeout(() => {
        startRecording()
      }, 500)
    }
    
    // Force camera on when entering test steps
    if (next >= 1 && next <= 3) {
      // Use setTimeout to ensure state has updated
      setTimeout(() => {
        if (!streamRef.current) {
          startCamera()
        } else if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
          videoRef.current.srcObject = streamRef.current
          videoRef.current.play().catch(() => {})
        }
      }, 100)
    }
  }, [step, startCamera, startRecording])

  // Ensure camera is on when advancing to any test step
  const advanceToStep = useCallback(
    (nextStep: number) => {
      setStep(nextStep)
      
      // Force camera on when entering test steps
      if (nextStep >= 1 && nextStep <= 3) {
        setTimeout(() => {
          if (!streamRef.current) {
            startCamera()
          } else if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
            videoRef.current.srcObject = streamRef.current
            videoRef.current.play().catch(() => {})
          }
        }, 100)
      }
    },
    [startCamera]
  )

  const handleSpeechComplete = useCallback(
    (data: SpeechData) => {
      setResults((prev) => ({ ...prev, speech: data }))
      advanceToStep(2)
    },
    [advanceToStep]
  )

  const handleHandComplete = useCallback(
    (data: HandData) => {
      setResults((prev) => ({ ...prev, hand: data }))
      advanceToStep(3)
    },
    [advanceToStep]
  )

  const handleEyeComplete = useCallback(
    async (data: EyeData) => {
      // Stop recording and get the video URL
      const recordingUrl = await stopRecording()
      
      setResults((prev) => ({ ...prev, eye: data, recordingUrl }))
      // Save to history when all tasks done
      const finalResults = { ...results, eye: data, recordingUrl }
      const assessment: StoredAssessment = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        results: finalResults,
      }
      const newHistory = [assessment, ...history]
      setHistory(newHistory)
      saveHistory(newHistory)
      advanceToStep(4)
    },
    [advanceToStep, results, history, stopRecording]
  )

  // Skip handlers: produce data with wasSkipped=true
  const handleSkipSpeech = useCallback(() => {
    handleSpeechComplete({
      duration: 0,
      words: [],
      letter: "",
      repeatWords: {},
      wasSkipped: true,
      restartCount: 0,
    })
  }, [handleSpeechComplete])

  const handleSkipHand = useCallback(() => {
    handleHandComplete({
      stability: 0,
      samples: 0,
      positions: [],
      varianceX: 0,
      varianceY: 0,
      wasSkipped: true,
      restartCount: 0,
    })
  }, [handleHandComplete])

  const handleSkipEye = useCallback(() => {
    handleEyeComplete({
      smoothness: 0,
      samples: 0,
      deltas: [],
      meanDelta: 0,
      maxDelta: 0,
      gazeOnTarget: 0,
      wasSkipped: true,
      restartCount: 0,
    })
  }, [handleEyeComplete])

  const handleRestart = useCallback(() => {
    // Clean up old recording URL
    if (results.recordingUrl) {
      URL.revokeObjectURL(results.recordingUrl)
    }
    
    setStep(0)
    setResults({ speech: null, hand: null, eye: null, recordingUrl: undefined })
    setView("assessment")
    setSelectedReport(null)
    if (!cameraOn) {
      startCamera()
    }
  }, [cameraOn, startCamera, results.recordingUrl])

  const handleContinueFromResults = useCallback(() => {
    setStep(5)
  }, [])

  const handleBackToResults = useCallback(() => {
    setStep(4)
  }, [])

  const handleSendToDoctor = useCallback(() => {
    // Will be handled in Task 3 - PDF generation
    // For now go to a send-to-doctor flow
    setStep(6)
  }, [])

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

  // Auto-start camera when entering any test step (1-3)
  // Also poll cameraOn so if camera drops mid-test it restarts
  useEffect(() => {
    if (view === "assessment" && step >= 1 && step <= 3) {
      if (!cameraOn && !streamRef.current) {
        startCamera()
      }
    }
    // Stop camera when reaching results or post-results
    if (step >= 4 && cameraOn) {
      stopCamera()
    }
  }, [step, view, cameraOn, startCamera, stopCamera])

  // Ensure video element has the stream when it mounts or step changes
  useEffect(() => {
    if (videoRef.current && streamRef.current && step >= 1 && step <= 3) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current
        videoRef.current.play().catch((err) => {
          if (!err.message?.includes('interrupted')) {
            console.error("Video play error:", err)
          }
        })
      }
    }
  }, [step])

  // Only show camera panel for active test steps, not results
  const showCamera = step >= 1 && step <= 3 && view === "assessment"

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
              Inquire
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
        </div>
      </header>

      {/* History view */}
      {view === "history" && (
        <main className="flex flex-1 flex-col items-center p-4 sm:p-6 animate-in fade-in duration-500">
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
              <div className="w-full shrink-0 lg:w-[360px] animate-in fade-in slide-in-from-left-8 duration-500">
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
              <div className="flex-1 animate-in fade-in slide-in-from-right-8 duration-500">
                {step === 1 && (
                  <SpeechTask
                    onComplete={handleSpeechComplete}
                    onSkip={handleSkipSpeech}
                  />
                )}
                {step === 2 && (
                  <HandTracking
                    videoRef={videoRef}
                    cameraOn={cameraOn}
                    onComplete={handleHandComplete}
                    onSkip={handleSkipHand}
                  />
                )}
                {step === 3 && (
                  <EyeTracking
                    videoRef={videoRef}
                    cameraOn={cameraOn}
                    onComplete={handleEyeComplete}
                    onSkip={handleSkipEye}
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
                  {/* Smooth animations for all components */}
                  <div className="flex flex-col items-center gap-4 py-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" style={{ animationDuration: '3s' }} />
                      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary shadow-lg">
                        <Brain className="h-12 w-12 text-primary-foreground" />
                      </div>
                    </div>
                    <h1 className="text-4xl font-bold text-foreground">
                      Inquire
                    </h1>
                    <p className="text-lg text-muted-foreground">
                      Cognitive Assessment Tool
                    </p>
                  </div>

                  {/* Smooth animation for welcome card */}
                  <Card className="w-full max-w-[480px] border-border bg-card p-6 animate-in slide-in-from-bottom-12 fade-in duration-1000 delay-[1600ms]">
                    <h2 className="mb-2 text-xl font-semibold text-foreground text-balance">
                      Welcome to Your Assessment
                    </h2>
                    <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                      This tool performs a quick cognitive screening through
                      three short tasks. Make sure you are in a well-lit environment
                      and ready to begin.
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
                    >
                      Begin Assessment
                    </Button>
                  </Card>
                </div>
              )}

              {step === 4 && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
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
                    onContinue={handleContinueFromResults}
                    onViewHistory={() => setView("history")}
                    allHistory={history}
                  />
                </div>
              )}

              {step === 5 && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <PostResultsActions
                    results={selectedReport?.results ?? results}
                    allHistory={history}
                    onRestart={handleRestart}
                    onViewHistory={() => setView("history")}
                    onSendToDoctor={handleSendToDoctor}
                    onBack={handleBackToResults}
                  />
                </div>
              )}

              {step === 6 && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <SendToDoctor
                    results={selectedReport?.results ?? results}
                    allHistory={history}
                    onBack={() => setStep(5)}
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
