"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  Plus,
  Trash2,
  Eye as EyeIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  BarChart3,
} from "lucide-react"
import type { StoredAssessment } from "./assessment-flow"

interface AssessmentHistoryProps {
  history: StoredAssessment[]
  onViewReport: (assessment: StoredAssessment) => void
  onDelete: (id: string) => void
  onNewAssessment: () => void
}

function computeScores(assessment: StoredAssessment) {
  const matchingWords = assessment.results.speech
    ? assessment.results.speech.words.filter((w) =>
        w.startsWith(assessment.results.speech!.letter.toLowerCase())
      ).length
    : 0
  const speechScore = Math.min(100, Math.round((matchingWords / 14) * 100))
  const handScore = assessment.results.hand?.stability ?? 0
  const eyeScore = assessment.results.eye?.smoothness ?? 0
  const overall = Math.round((speechScore + handScore + eyeScore) / 3)
  return { speechScore, handScore, eyeScore, overall }
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatShortDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function TrendIcon({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous
  if (Math.abs(diff) < 2) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
  if (diff > 0) return <TrendingUp className="h-3.5 w-3.5 text-accent" />
  return <TrendingDown className="h-3.5 w-3.5 text-destructive" />
}

export function AssessmentHistory({
  history,
  onViewReport,
  onDelete,
  onNewAssessment,
}: AssessmentHistoryProps) {
  // Compute statistics across all attempts
  const stats = useMemo(() => {
    if (history.length === 0) return null

    const allScores = history.map(computeScores)

    const avg = (arr: number[]) =>
      arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0
    const best = (arr: number[]) =>
      arr.length > 0 ? Math.round(Math.max(...arr)) : 0

    return {
      totalAttempts: history.length,
      avgOverall: avg(allScores.map((s) => s.overall)),
      avgSpeech: avg(allScores.map((s) => s.speechScore)),
      avgMotor: avg(allScores.map((s) => s.handScore)),
      avgEyes: avg(allScores.map((s) => s.eyeScore)),
      bestOverall: best(allScores.map((s) => s.overall)),
      bestSpeech: best(allScores.map((s) => s.speechScore)),
      bestMotor: best(allScores.map((s) => s.handScore)),
      bestEyes: best(allScores.map((s) => s.eyeScore)),
    }
  }, [history])

  // Trend chart data (oldest first)
  const trendData = useMemo(() => {
    return [...history]
      .reverse()
      .map((a, idx) => {
        const s = computeScores(a)
        return {
          attempt: idx + 1,
          date: formatShortDate(a.timestamp),
          Overall: s.overall,
          Speech: s.speechScore,
          Motor: Math.round(s.handScore),
          Eyes: Math.round(s.eyeScore),
        }
      })
  }, [history])

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <BarChart3 className="h-16 w-16 text-muted-foreground/40" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">
            No Assessments Yet
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Complete your first neurological screening to see your results and
            track your progress over time.
          </p>
        </div>
        <Button className="gap-2" onClick={onNewAssessment}>
          <Plus className="h-4 w-4" />
          Start First Assessment
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Assessment History
          </h2>
          <p className="text-sm text-muted-foreground">
            {history.length} assessment{history.length !== 1 ? "s" : ""}{" "}
            recorded
          </p>
        </div>
        <Button className="gap-2" onClick={onNewAssessment}>
          <Plus className="h-4 w-4" />
          New Assessment
        </Button>
      </div>

      {/* Aggregate statistics */}
      {stats && (
        <Card className="border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Aggregate Statistics
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-secondary p-3 text-center">
              <p className="text-2xl font-bold text-foreground">
                {stats.avgOverall}
              </p>
              <p className="text-xs text-muted-foreground">Avg Overall</p>
            </div>
            <div className="rounded-lg bg-secondary p-3 text-center">
              <p className="text-2xl font-bold text-primary">
                {stats.avgSpeech}
              </p>
              <p className="text-xs text-muted-foreground">Avg Speech</p>
            </div>
            <div className="rounded-lg bg-secondary p-3 text-center">
              <p className="text-2xl font-bold text-accent">
                {stats.avgMotor}
              </p>
              <p className="text-xs text-muted-foreground">Avg Motor</p>
            </div>
            <div className="rounded-lg bg-secondary p-3 text-center">
              <p
                className="text-2xl font-bold"
                style={{ color: "hsl(var(--chart-3))" }}
              >
                {stats.avgEyes}
              </p>
              <p className="text-xs text-muted-foreground">Avg Eyes</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-lg font-bold text-foreground">
                {stats.bestOverall}
              </p>
              <p className="text-xs text-muted-foreground">Best Overall</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-lg font-bold text-primary">
                {stats.bestSpeech}
              </p>
              <p className="text-xs text-muted-foreground">Best Speech</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-lg font-bold text-accent">
                {stats.bestMotor}
              </p>
              <p className="text-xs text-muted-foreground">Best Motor</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p
                className="text-lg font-bold"
                style={{ color: "hsl(var(--chart-3))" }}
              >
                {stats.bestEyes}
              </p>
              <p className="text-xs text-muted-foreground">Best Eyes</p>
            </div>
          </div>
        </Card>
      )}

      {/* Trend chart */}
      {trendData.length >= 2 && (
        <Card className="border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Score Trends Over Time
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={trendData}
              margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="date"
                tick={{
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 11,
                }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 11,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--foreground))",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="Overall"
                stroke="hsl(var(--foreground))"
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--foreground))" }}
              />
              <Line
                type="monotone"
                dataKey="Speech"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                strokeDasharray="4 2"
              />
              <Line
                type="monotone"
                dataKey="Motor"
                stroke="hsl(var(--accent))"
                strokeWidth={1.5}
                dot={{ r: 3, fill: "hsl(var(--accent))" }}
                strokeDasharray="4 2"
              />
              <Line
                type="monotone"
                dataKey="Eyes"
                stroke="hsl(var(--chart-3))"
                strokeWidth={1.5}
                dot={{ r: 3, fill: "hsl(var(--chart-3))" }}
                strokeDasharray="4 2"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 bg-foreground" />
              Overall
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 bg-primary" />
              Speech
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 bg-accent" />
              Motor
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="h-0.5 w-4"
                style={{ backgroundColor: "hsl(var(--chart-3))" }}
              />
              Eyes
            </div>
          </div>
        </Card>
      )}

      {/* Assessment list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Past Assessments
        </h3>
        {history.map((assessment, idx) => {
          const scores = computeScores(assessment)
          const prev = idx < history.length - 1 ? computeScores(history[idx + 1]) : null

          return (
            <Card
              key={assessment.id}
              className="border-border bg-card p-4 transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center gap-4">
                {/* Overall score circle */}
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-secondary">
                  <div className="text-center">
                    <p className="text-lg font-bold leading-none text-foreground">
                      {scores.overall}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      {formatDate(assessment.timestamp)}
                    </p>
                    {prev && (
                      <TrendIcon
                        current={scores.overall}
                        previous={prev.overall}
                      />
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>
                      Speech:{" "}
                      <span className="font-medium text-primary">
                        {scores.speechScore}
                      </span>
                    </span>
                    <span>
                      Motor:{" "}
                      <span className="font-medium text-accent">
                        {Math.round(scores.handScore)}
                      </span>
                    </span>
                    <span>
                      Eyes:{" "}
                      <span
                        className="font-medium"
                        style={{ color: "hsl(var(--chart-3))" }}
                      >
                        {Math.round(scores.eyeScore)}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onViewReport(assessment)}
                  >
                    <EyeIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">View</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(assessment.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
