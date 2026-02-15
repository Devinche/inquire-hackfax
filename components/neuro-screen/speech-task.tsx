"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Mic, Square, CheckCircle2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { SpeechData } from "./assessment-flow"

const LETTERS = ["F", "A", "S", "P", "M", "B", "T", "C"]
const MAX_DURATION = 60

interface SpeechTaskProps {
  onComplete: (data: SpeechData) => void
}

export function SpeechTask({ onComplete }: SpeechTaskProps) {
  const [status, setStatus] = useState<"idle" | "recording" | "done">("idle")
  const [timeLeft, setTimeLeft] = useState(MAX_DURATION)
  const [letter] = useState(
    () => LETTERS[Math.floor(Math.random() * LETTERS.length)]
  )
  const [capturedWords, setCapturedWords] = useState<string[]>([])
  const [liveTranscript, setLiveTranscript] = useState("")

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const recognitionRef = useRef<any>(null)
  const wordsRef = useRef<string[]>([])
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

    // Deduplicate words
    const uniqueWords = [...new Set(wordsRef.current)]

    setTimeout(() => {
      onComplete({
        duration,
        words: uniqueWords,
        letter,
      })
    }, 0)
  }, [cleanup, letter, onComplete])

  const startRecording = useCallback(async () => {
    stoppedRef.current = false
    wordsRef.current = []
    setCapturedWords([])
    setLiveTranscript("")

    // Check for Web Speech API support
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      // Fallback: just do a timed recording without transcription
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
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop()) // release immediately, SpeechRecognition handles its own audio

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
            // Extract individual words from the final transcript
            const newWords = transcript
              .split(/\s+/)
              .map((w: string) => w.toLowerCase().replace(/[^a-z']/g, ""))
              .filter((w: string) => w.length > 0)

            for (const w of newWords) {
              if (!wordsRef.current.includes(w)) {
                wordsRef.current.push(w)
              }
            }
            setCapturedWords([...wordsRef.current])
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
        // Restart if not done yet
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

  const elapsed = MAX_DURATION - timeLeft
  const progress = (elapsed / MAX_DURATION) * 100

  return (
    <Card className="border-border bg-card p-6">
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        Speech Task
      </h2>
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
        <Button className="w-full gap-2" onClick={startRecording}>
          <Mic className="h-4 w-4" />
          Start Recording
        </Button>
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
              <p className="text-lg font-bold text-foreground">
                {capturedWords.length}
              </p>
            </div>
            {capturedWords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {capturedWords.map((word, i) => (
                  <span
                    key={`${word}-${i}`}
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      word.startsWith(letter.toLowerCase())
                        ? "bg-accent/20 text-accent"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {word}
                  </span>
                ))}
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

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={finishRecording}
          >
            <Square className="h-4 w-4" />
            Stop Recording
          </Button>
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
