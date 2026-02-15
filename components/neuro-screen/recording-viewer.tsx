"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Download } from "lucide-react"

interface RecordingViewerProps {
  recordingUrl: string
  onClose: () => void
}

export function RecordingViewer({ recordingUrl, onClose }: RecordingViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.src = recordingUrl
    }
  }, [recordingUrl])

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = recordingUrl
    a.download = `assessment-recording-${Date.now()}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-4xl border-border bg-card p-6 animate-in zoom-in-95 duration-300">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            Assessment Recording
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4 aspect-video w-full overflow-hidden rounded-lg bg-secondary">
          <video
            ref={videoRef}
            controls
            className="h-full w-full object-contain"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Download Recording
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  )
}
