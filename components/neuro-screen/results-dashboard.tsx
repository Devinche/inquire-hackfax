"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { RotateCcw, Mic, Hand, Eye, Activity, FileText } from "lucide-react"
import type { AssessmentResults } from "./assessment-flow"

interface ResultsDashboardProps {
  results: AssessmentResults
  onRestart: () => void
}

function getScoreLabel(score: number): { text: string; color: string } {
  if (score >= 80) return { text: "Excellent", color: "text-accent" }
  if (score >= 60) return { text: "Good", color: "text-primary" }
  if (score >= 40) return { text: "Moderate", color: "text-yellow-500" }
  return { text: "Needs attention", color: "text-destructive" }
}

export function ResultsDashboard({
  results,
  onRestart,
}: ResultsDashboardProps) {
  const speechScore = results.speech
    ? Math.min(100, Math.round((results.speech.duration / 60) * 100))
    : 0
  const handScore = results.hand?.stability ?? 0
  const eyeScore = results.eye?.smoothness ?? 0
  const overallScore = Math.round((speechScore + handScore + eyeScore) / 3)

  const radarData = [
    { task: "Speech", score: speechScore, fullMark: 100 },
    { task: "Motor", score: handScore, fullMark: 100 },
    { task: "Eyes", score: eyeScore, fullMark: 100 },
  ]

  const barData = [
    { name: "Speech", score: speechScore, fill: "hsl(var(--primary))" },
    { name: "Motor", score: handScore, fill: "hsl(var(--accent))" },
    { name: "Eyes", score: eyeScore, fill: "hsl(var(--chart-3))" },
  ]

  const overall = getScoreLabel(overallScore)

  return (
    <div className="space-y-6">
      {/* Overall score */}
      <Card className="border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">
            Assessment Results
          </h2>
        </div>

        <div className="flex flex-col items-center gap-2 py-4">
          <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-primary bg-secondary">
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">
                {overallScore}
              </p>
              <p className="text-xs text-muted-foreground">Overall</p>
            </div>
          </div>
          <p className={`text-sm font-semibold ${overall.color}`}>
            {overall.text}
          </p>
        </div>
      </Card>

      {/* Individual scores */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Mic className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Speech</p>
              <p className="text-lg font-bold text-foreground">{speechScore}</p>
            </div>
          </div>
          <p className={`text-xs font-medium ${getScoreLabel(speechScore).color}`}>
            {getScoreLabel(speechScore).text}
          </p>
          {results.speech && (
            <p className="mt-1 text-xs text-muted-foreground">
              Duration: {results.speech.duration}s
            </p>
          )}
        </Card>

        <Card className="border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <Hand className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Motor</p>
              <p className="text-lg font-bold text-foreground">
                {handScore.toFixed(1)}
              </p>
            </div>
          </div>
          <p className={`text-xs font-medium ${getScoreLabel(handScore).color}`}>
            {getScoreLabel(handScore).text}
          </p>
          {results.hand && (
            <p className="mt-1 text-xs text-muted-foreground">
              Samples: {results.hand.samples}
            </p>
          )}
        </Card>

        <Card className="border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-3/10">
              <Eye className="h-4 w-4" style={{ color: "hsl(var(--chart-3))" }} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Eyes</p>
              <p className="text-lg font-bold text-foreground">
                {eyeScore.toFixed(1)}
              </p>
            </div>
          </div>
          <p className={`text-xs font-medium ${getScoreLabel(eyeScore).color}`}>
            {getScoreLabel(eyeScore).text}
          </p>
          {results.eye && (
            <p className="mt-1 text-xs text-muted-foreground">
              Samples: {results.eye.samples}
            </p>
          )}
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium text-foreground">
            Performance Radar
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="task"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              />
              <Radar
                name="Score"
                dataKey="score"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium text-foreground">
            Score Breakdown
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="name"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--foreground))",
                }}
              />
              <Bar dataKey="score" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Disclaimer */}
      <Card className="border-border bg-card p-4">
        <div className="flex gap-3">
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            This tool is for screening purposes only and does not constitute a
            medical diagnosis. The scoring model is heuristic-based and would
            require clinical validation before deployment. Please consult a
            healthcare professional for proper assessment.
          </p>
        </div>
      </Card>

      {/* Restart */}
      <Button variant="outline" className="w-full gap-2" onClick={onRestart}>
        <RotateCcw className="h-4 w-4" />
        Restart Assessment
      </Button>
    </div>
  )
}
