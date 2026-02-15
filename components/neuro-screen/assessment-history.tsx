"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  Send,
  CheckSquare,
  Square,
} from "lucide-react"
import type { StoredAssessment } from "./assessment-flow"

interface AssessmentHistoryProps {
  history: StoredAssessment[]
  onViewReport: (assessment: StoredAssessment) => void
  onDelete: (id: string) => void
  onDeleteMultiple?: (ids: string[]) => void
  onNewAssessment: () => void
  onSendToDoctor?: (selectedAssessments: StoredAssessment[]) => void
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
  onDeleteMultiple,
  onNewAssessment,
  onSendToDoctor,
}: AssessmentHistoryProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [assessmentToDelete, setAssessmentToDelete] = useState<string | null>(null)
  const [assessmentsToDelete, setAssessmentsToDelete] = useState<string[]>([])
  const [deleteCount, setDeleteCount] = useState(1)
  
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }
  
  const toggleSelectAll = () => {
    if (selectedIds.size === history.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(history.map(a => a.id)))
    }
  }
  
  const handleSendToDoctor = () => {
    if (onSendToDoctor && selectedIds.size > 0) {
      const selected = history.filter(a => selectedIds.has(a.id))
      onSendToDoctor(selected)
    }
  }
  
  const handleDeleteClick = (id: string) => {
    setAssessmentToDelete(id)
    setAssessmentsToDelete([])
    setDeleteCount(1)
    setDeleteDialogOpen(true)
  }
  
  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return
    const idsArray = Array.from(selectedIds)
    setAssessmentsToDelete(idsArray)
    setAssessmentToDelete(null)
    setDeleteCount(idsArray.length)
    setDeleteDialogOpen(true)
  }
  
  const handleConfirmDelete = () => {
    if (assessmentsToDelete.length > 0) {
      // Bulk delete
      if (onDeleteMultiple) {
        onDeleteMultiple(assessmentsToDelete)
      } else {
        // Fallback: delete one by one
        assessmentsToDelete.forEach(id => onDelete(id))
      }
      setSelectedIds(new Set()) // Clear selection after bulk delete
      setAssessmentsToDelete([])
    } else if (assessmentToDelete) {
      // Single delete
      onDelete(assessmentToDelete)
      setAssessmentToDelete(null)
    }
    setDeleteDialogOpen(false)
  }
  
  const handleCancelDelete = () => {
    setAssessmentToDelete(null)
    setAssessmentsToDelete([])
    setDeleteDialogOpen(false)
  }
  
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
      <div className="flex flex-col items-center gap-4 py-12 animate-in fade-in slide-in-from-bottom-8 duration-500">
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
      <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Assessment History
          </h2>
          <p className="text-sm text-muted-foreground">
            {history.length} assessment{history.length !== 1 ? "s" : ""}{" "}
            recorded
            {selectedIds.size > 0 && (
              <span className="ml-2 text-primary">
                • {selectedIds.size} selected
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && onSendToDoctor && (
            <Button 
              variant="default" 
              className="gap-2"
              onClick={handleSendToDoctor}
            >
              <Send className="h-4 w-4" />
              Send to Doctor ({selectedIds.size})
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Button 
              variant="outline" 
              className="gap-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="h-4 w-4" />
              Delete ({selectedIds.size})
            </Button>
          )}
          <Button className="gap-2" onClick={onNewAssessment}>
            <Plus className="h-4 w-4" />
            New Assessment
          </Button>
        </div>
      </div>

      {/* Aggregate statistics */}
      {stats && (
        <Card className="border-border bg-card p-6 animate-in fade-in slide-in-from-bottom-6 duration-500 delay-100">
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
        <Card className="border-border bg-card p-6 animate-in fade-in slide-in-from-bottom-6 duration-500 delay-200">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Score Trends Over Time
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={trendData}
              margin={{ top: 5, right: 10, bottom: 30, left: 15 }}
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
                label={{
                  value: "Assessment Date",
                  position: "bottom",
                  offset: 0,
                  style: {
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 12,
                    fontWeight: 600,
                    textAnchor: 'middle'
                  }
                }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 11,
                }}
                label={{
                  value: "Score (0-100)",
                  angle: -90,
                  position: "left",
                  offset: 10,
                  style: {
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 12,
                    fontWeight: 600,
                    textAnchor: 'middle'
                  }
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
                formatter={(value: any) => {
                  if (typeof value === 'number') {
                    return value.toFixed(1)
                  }
                  return value
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
      <div className="space-y-3 animate-in fade-in slide-in-from-bottom-6 duration-500 delay-300">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Past Assessments
          </h3>
          {history.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-xs"
              onClick={toggleSelectAll}
            >
              {selectedIds.size === history.length ? (
                <>
                  <CheckSquare className="h-3.5 w-3.5" />
                  Deselect All
                </>
              ) : (
                <>
                  <Square className="h-3.5 w-3.5" />
                  Select All
                </>
              )}
            </Button>
          )}
        </div>
        {history.map((assessment, idx) => {
          const scores = computeScores(assessment)
          const prev = idx < history.length - 1 ? computeScores(history[idx + 1]) : null
          const isSelected = selectedIds.has(assessment.id)

          return (
            <Card
              key={assessment.id}
              className={`border-border bg-card p-4 transition-all duration-300 ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5 shadow-lg' 
                  : 'hover:bg-secondary/50 hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Checkbox */}
                <div className="flex items-center">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelection(assessment.id)}
                    className="h-5 w-5"
                  />
                </div>

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
                    onClick={() => handleDeleteClick(assessment.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteCount === 1 ? 'Assessment' : `${deleteCount} Assessments`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteCount === 1 ? 'this assessment' : `these ${deleteCount} assessments`}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
