"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  RotateCcw,
  History,
  Send,
  ChevronLeft,
  Brain,
} from "lucide-react"
import type { AssessmentResults, StoredAssessment } from "./assessment-flow"

interface PostResultsActionsProps {
  results: AssessmentResults
  allHistory: StoredAssessment[]
  onRestart: () => void
  onViewHistory: () => void
  onSendToDoctor: () => void
  onBack: () => void
}

export function PostResultsActions({
  onRestart,
  onViewHistory,
  onSendToDoctor,
  onBack,
}: PostResultsActionsProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Back button */}
      <div className="w-full max-w-lg">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={onBack}
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Results
        </Button>
      </div>

      {/* Heading */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Brain className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground text-balance">
          Assessment Complete
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
          What would you like to do next? You can start a new assessment, review
          your history, or share your results with a healthcare professional.
        </p>
      </div>

      {/* Action cards */}
      <div className="grid w-full max-w-lg gap-4 sm:grid-cols-3">
        <button
          onClick={onRestart}
          className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <RotateCcw className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              New Assessment
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Start a fresh set of tests
            </p>
          </div>
        </button>

        <button
          onClick={onViewHistory}
          className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center transition-colors hover:border-accent hover:bg-accent/5"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
            <History className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              View History
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              See all past assessments
            </p>
          </div>
        </button>

        <button
          onClick={onSendToDoctor}
          className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Send className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Send to Doctor
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Generate PDF medical form
            </p>
          </div>
        </button>
      </div>
    </div>
  )
}
