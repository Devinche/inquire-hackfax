"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Mic, Square, CheckCircle2, SkipForward, RotateCcw } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { SpeechData } from "./assessment-flow"

const LETTERS = ["F", "A", "S", "P", "M", "B", "T", "C"]
const MAX_DURATION = 60

interface SpeechTaskProps {
  onComplete: (data: SpeechData) => void
  onSkip: () => void
}

export function SpeechTask({ onComplete, onSkip }: SpeechTaskProps) {
  const [status, setStatus] = useState<"idle" | "recording" | "done">("idle")
  const [timeLeft, setTimeLeft] = useState(MAX_DURATION)
  const [letter] = useState(
    () => LETTERS[Math.floor(Math.random() * LETTERS.length)]
  )
  const [capturedWords, setCapturedWords] = useState<string[]>([])
  const [liveTranscript, setLiveTranscript] = useState("")
  const [restartCount, setRestartCount] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const recognitionRef = useRef<any>(null)
  // Track ALL occurrences (including repeats) for repeat analysis
  const allWordsRef = useRef<string[]>([])
  const wordCountsRef = useRef<Record<string, number>>({})
  const stoppedRef = useRef(false)

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // already stopped
      }
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const finishRecording = useCallback(() => {
    if (stoppedRef.current) return
    stoppedRef.current = true

    cleanup()
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
    setStatus("done")

    // Deduplicate words for the final list
    const uniqueWords = [...new Set(allWordsRef.current)]

    // Build repeat map: only include words said more than once
    const repeatWords: Record<string, number> = {}
    for (const [word, count] of Object.entries(wordCountsRef.current)) {
      if (count > 1) {
        repeatWords[word] = count
      }
    }

    setTimeout(() => {
      onComplete({
        duration,
        words: uniqueWords,
        letter,
        repeatWords,
        wasSkipped: false,
        restartCount,
      })
    }, 0)
  }, [cleanup, letter, onComplete, restartCount])

  const startRecording = useCallback(async () => {
    stoppedRef.current = false
    allWordsRef.current = []
    wordCountsRef.current = {}
    setCapturedWords([])
    setLiveTranscript("")

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setStatus("recording")
      startTimeRef.current = Date.now()
      setTimeLeft(MAX_DURATION)

      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - startTimeRef.current) / 1000
        )
        const remaining = Math.max(0, MAX_DURATION - elapsed)
        setTimeLeft(remaining)
        if (remaining <= 0) {
          finishRecording()
        }
      }, 250)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "en-US"
      recognitionRef.current = recognition

      recognition.onresult = (event: any) => {
        let interim = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim()
          if (event.results[i].isFinal) {
            const newWords = transcript
              .split(/\s+/)
              .map((w: string) => w.toLowerCase().replace(/[^a-z']/g, ""))
              .filter((w: string) => w.length > 0)

            for (const w of newWords) {
              allWordsRef.current.push(w)
              wordCountsRef.current[w] =
                (wordCountsRef.current[w] || 0) + 1
            }
            // Update displayed words (unique only)
            setCapturedWords([...new Set(allWordsRef.current)])
          } else {
            interim = transcript
          }
        }
        setLiveTranscript(interim)
      }

      recognition.onerror = (event: any) => {
        if (event.error !== "aborted" && event.error !== "no-speech") {
          console.error("Speech recognition error:", event.error)
        }
      }

      recognition.onend = () => {
        if (!stoppedRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start()
          } catch {
            // ignore
          }
        }
      }

      recognition.start()
      setStatus("recording")
      startTimeRef.current = Date.now()
      setTimeLeft(MAX_DURATION)

      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - startTimeRef.current) / 1000
        )
        const remaining = Math.max(0, MAX_DURATION - elapsed)
        setTimeLeft(remaining)
        if (remaining <= 0) {
          finishRecording()
        }
      }, 250)
    } catch (err) {
      console.error("Microphone error:", err)
    }
  }, [finishRecording])

  const handleRestart = useCallback(() => {
    stoppedRef.current = true
    cleanup()
    setRestartCount((c) => c + 1)
    setStatus("idle")
    setTimeLeft(MAX_DURATION)
    setCapturedWords([])
    setLiveTranscript("")
    allWordsRef.current = []
    wordCountsRef.current = {}
  }, [cleanup])

  const elapsed = MAX_DURATION - timeLeft
  const progress = (elapsed / MAX_DURATION) * 100

  // Count repeated words in real time
  const repeatCount = Object.values(wordCountsRef.current).filter(
    (c) => c > 1
  ).length

  return (
    <Card className="border-border bg-card p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Speech Task</h2>
        {status === "idle" ? (
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
      <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
        Say as many words as you can that start with the letter shown below. You
        have 60 seconds, but you can stop early. Based on the phonemic verbal
        fluency test (FAS) used in neuropsychological assessments.
      </p>

      {/* Letter display */}
      <div className="mb-6 flex flex-col items-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary">
          <span className="text-5xl font-bold text-primary-foreground">
            {letter}
          </span>
        </div>
      </div>

      {status === "idle" && (
        <div className="space-y-3">
          <Button className="w-full gap-2" onClick={startRecording}>
            <Mic className="h-4 w-4" />
            {restartCount > 0 ? "Start Again" : "Start Recording"}
          </Button>
          {restartCount > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Restarted {restartCount} time{restartCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {status === "recording" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Time remaining</span>
            <span className="font-mono font-semibold text-foreground">
              {timeLeft}s
            </span>
          </div>
          <Progress value={progress} className="h-2" />

          {/* Live word count and transcript */}
          <div className="rounded-lg bg-secondary p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Words captured
              </p>
              <div className="flex items-center gap-3">
                {repeatCount > 0 && (
                  <p className="text-xs text-yellow-500">
                    {repeatCount} repeated
                  </p>
                )}
                <p className="text-lg font-bold text-foreground">
                  {capturedWords.length}
                </p>
              </div>
            </div>
            {capturedWords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {capturedWords.map((word, i) => {
                  const isRepeat = (wordCountsRef.current[word] ?? 0) > 1
                  const matches = word.startsWith(letter.toLowerCase())
                  return (
                    <span
                      key={`${word}-${i}`}
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isRepeat
                          ? "bg-yellow-500/20 text-yellow-600 ring-1 ring-yellow-500/30"
                          : matches
                            ? "bg-accent/20 text-accent"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {word}
                      {isRepeat && (
                        <span className="ml-1 text-yellow-500">
                          x{wordCountsRef.current[word]}
                        </span>
                      )}
                    </span>
                  )
                })}
              </div>
            )}
            {liveTranscript && (
              <p className="mt-2 text-xs text-muted-foreground italic">
                {liveTranscript}...
              </p>
            )}
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
            </span>
            <span className="text-sm font-medium text-destructive">
              Recording...
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
              onClick={finishRecording}
            >
              <Square className="h-3.5 w-3.5" />
              Stop Recording
            </Button>
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="flex flex-col items-center gap-3">
          <CheckCircle2 className="h-10 w-10 text-accent" />
          <p className="text-sm font-medium text-foreground">
            Recording complete! Moving to next task...
          </p>
        </div>
      )}
    </Card>
  )
}
