"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Mic, Square, CheckCircle2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"

const LETTERS = ["F", "A", "S", "P", "M", "B", "T", "C"]
const MAX_DURATION = 60

interface SpeechTaskProps {
  onComplete: (data: { duration: number; fileSize: number }) => void
}

export function SpeechTask({ onComplete }: SpeechTaskProps) {
  const [status, setStatus] = useState<"idle" | "recording" | "done">("idle")
  const [timeLeft, setTimeLeft] = useState(MAX_DURATION)
  const [letter] = useState(
    () => LETTERS[Math.floor(Math.random() * LETTERS.length)]
  )

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const stopRecording = useCallback(() => {
    cleanup()
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop()
    }
  }, [cleanup])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setStatus("recording")
      audioChunksRef.current = []
      startTimeRef.current = Date.now()

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        stream.getTracks().forEach((t) => t.stop())
        setStatus("done")
        onComplete({ duration, fileSize: blob.size })
      }

      mediaRecorder.start(1000)

      setTimeLeft(MAX_DURATION)
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      console.error("Microphone error:", err)
    }
  }, [onComplete, stopRecording])

  const elapsed = MAX_DURATION - timeLeft
  const progress = (elapsed / MAX_DURATION) * 100

  return (
    <Card className="border-border bg-card p-6">
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        Speech Task
      </h2>
      <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
        Say as many words as you can that start with the letter shown below. You
        have 60 seconds, but you can stop early.
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
            onClick={stopRecording}
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
