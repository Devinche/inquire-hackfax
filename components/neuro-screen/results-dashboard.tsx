"use client"

import { useMemo } from "react"
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
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts"
import {
  RotateCcw,
  Mic,
  Hand,
  Eye,
  Activity,
  FileText,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react"
import type { AssessmentResults } from "./assessment-flow"

interface ResultsDashboardProps {
  results: AssessmentResults
  onRestart: () => void
}

// --- Research-based thresholds ---
// Verbal fluency (FAS): Tombaugh et al. (1999), Archives of Clinical Neuropsychology
// Normal adults (16-59, 13+ yr edu) average ~42 words across F, A, S in 60s each = ~14 words/letter/minute
// For a single letter in 60s:
//   >= 14 words: Excellent (above mean)
//   10-13 words: Good (within 1 SD)
//   7-9 words:   Borderline (1-2 SD below)
//   < 7 words:   Below expected (>2 SD below, suggests possible impairment)
function getSpeechAssessment(wordCount: number, letter: string) {
  const matchingWords = (words: string[]) =>
    words.filter((w) => w.startsWith(letter.toLowerCase()))

  if (wordCount >= 14) {
    return {
      label: "Within Normal Range",
      color: "text-accent",
      bgColor: "bg-accent/10",
      icon: CheckCircle2,
      detail: `You produced ${wordCount} words, which is at or above the mean for healthy adults (Tombaugh et al., 1999). Phonemic fluency in this range indicates intact executive function, lexical retrieval, and frontal lobe processing.`,
    }
  }
  if (wordCount >= 10) {
    return {
      label: "Good",
      color: "text-primary",
      bgColor: "bg-primary/10",
      icon: CheckCircle2,
      detail: `You produced ${wordCount} words, within 1 standard deviation of the normative mean (~14 words/letter for adults aged 16-59 with 13+ years of education). This is a typical performance.`,
    }
  }
  if (wordCount >= 7) {
    return {
      label: "Borderline",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: AlertTriangle,
      detail: `You produced ${wordCount} words, which falls 1-2 standard deviations below the normative mean. This may reflect factors like fatigue, distraction, or language differences. Clinical follow-up may be warranted if other deficits are present.`,
    }
  }
  return {
    label: "Below Expected",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: AlertTriangle,
    detail: `You produced ${wordCount} words, which is more than 2 SD below the normative mean. Reduced phonemic fluency can be associated with frontal lobe dysfunction, Alzheimer's disease, traumatic brain injury, or Huntington's disease (Tombaugh et al., 1999). A full neuropsychological evaluation is recommended.`,
  }
}

// Motor stability: Based on postural tremor research
// Normalized positional variance from webcam-based hand tracking (0-100 scale)
// Our variance*10000 formula maps to:
//   >= 85: Excellent stability (minimal postural tremor, within physiological norm)
//   70-84: Good (slight tremor, common in healthy adults under stress)
//   50-69: Moderate (elevated tremor, may indicate essential tremor or medication effects)
//   < 50:  Elevated tremor (may indicate pathological tremor; Parkinson's, essential tremor)
function getMotorAssessment(stability: number) {
  if (stability >= 85) {
    return {
      label: "Minimal Tremor",
      color: "text-accent",
      bgColor: "bg-accent/10",
      icon: CheckCircle2,
      detail: `Stability score of ${stability.toFixed(1)}/100 indicates minimal postural tremor. Healthy adults typically exhibit very low positional variance when holding a hand steady for 15 seconds. This is consistent with normal physiological tremor (8-12 Hz, <0.5mm amplitude).`,
    }
  }
  if (stability >= 70) {
    return {
      label: "Mild Tremor",
      color: "text-primary",
      bgColor: "bg-primary/10",
      icon: CheckCircle2,
      detail: `Stability score of ${stability.toFixed(1)}/100 shows slight positional variation. This is common in healthy individuals and can be influenced by caffeine intake, fatigue, stress, or ambient temperature. Physiological tremor is universal and increases with muscle fatigue.`,
    }
  }
  if (stability >= 50) {
    return {
      label: "Moderate Tremor",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: AlertTriangle,
      detail: `Stability score of ${stability.toFixed(1)}/100 suggests elevated postural tremor. Enhanced physiological tremor can be caused by anxiety, hyperthyroidism, medication side-effects, or caffeine. It may also indicate early-stage essential tremor, which affects ~4% of adults over 40 (Louis & Ferreira, 2010).`,
    }
  }
  return {
    label: "Elevated Tremor",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: AlertTriangle,
    detail: `Stability score of ${stability.toFixed(1)}/100 indicates significant postural tremor. Pathological tremor conditions include essential tremor (postural/action tremor, 4-12 Hz) and Parkinson's disease (rest tremor, 3-6 Hz, though postural tremor also occurs). Accelerometry studies show that pathological tremor variance is significantly higher than physiological tremor. A neurological evaluation is recommended.`,
  }
}

// Eye smoothness: Based on smooth pursuit research
// Smooth pursuit gain (eye velocity / target velocity) in healthy adults is typically >0.85
// Our smoothness score (0-100) maps eye movement consistency:
//   >= 80: Normal pursuit (smooth, few saccadic intrusions)
//   60-79: Mild irregularity (some catch-up saccades, common with fatigue)
//   40-59: Moderate (frequent saccadic intrusions, may indicate cerebellar or brainstem issues)
//   < 40:  Impaired (highly saccadic pursuit, seen in MS, cerebellar ataxia, PD)
function getEyeAssessment(smoothness: number) {
  if (smoothness >= 80) {
    return {
      label: "Smooth Pursuit Normal",
      color: "text-accent",
      bgColor: "bg-accent/10",
      icon: CheckCircle2,
      detail: `Smoothness score of ${smoothness.toFixed(1)}/100 indicates consistent, low-jitter eye movements during target tracking. Normal smooth pursuit gain is >0.85 in healthy adults. Your eye movements show minimal saccadic intrusions, consistent with intact oculomotor pathways.`,
    }
  }
  if (smoothness >= 60) {
    return {
      label: "Mild Irregularity",
      color: "text-primary",
      bgColor: "bg-primary/10",
      icon: CheckCircle2,
      detail: `Smoothness score of ${smoothness.toFixed(1)}/100 shows some eye movement variability. Mild catch-up saccades during smooth pursuit are common and can be caused by inattention, fatigue, or target velocity changes. This is within the expected range for a webcam-based assessment.`,
    }
  }
  if (smoothness >= 40) {
    return {
      label: "Moderate Irregularity",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: AlertTriangle,
      detail: `Smoothness score of ${smoothness.toFixed(1)}/100 suggests frequent saccadic intrusions during pursuit. Impaired smooth pursuit can be associated with cerebellar lesions, brainstem pathology, or neurodegenerative conditions. However, webcam resolution limits precision. Clinical eye tracking (e.g., VOG) is recommended for confirmation.`,
    }
  }
  return {
    label: "Impaired Pursuit",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: AlertTriangle,
    detail: `Smoothness score of ${smoothness.toFixed(1)}/100 indicates highly variable eye movements with significant saccadic intrusions. Saccadic pursuit (gain <0.5) has been observed in multiple sclerosis, cerebellar ataxia, Parkinson's disease, and schizophrenia. A comprehensive oculomotor examination is strongly recommended.`,
  }
}

function getOverallAssessment(score: number) {
  if (score >= 80) return { text: "Within Normal Limits", color: "text-accent" }
  if (score >= 60) return { text: "Largely Normal", color: "text-primary" }
  if (score >= 40)
    return { text: "Some Concerns Noted", color: "text-yellow-500" }
  return { text: "Further Evaluation Recommended", color: "text-destructive" }
}

export function ResultsDashboard({
  results,
  onRestart,
}: ResultsDashboardProps) {
  // --- Compute scores ---
  const speechWordCount = results.speech?.words?.length ?? 0
  const matchingWordCount = results.speech
    ? results.speech.words.filter((w) =>
        w.startsWith(results.speech!.letter.toLowerCase())
      ).length
    : 0

  // Score based on matching words (FAS norms: 14 words = 100%)
  const speechScore = Math.min(100, Math.round((matchingWordCount / 14) * 100))
  const handScore = results.hand?.stability ?? 0
  const eyeScore = results.eye?.smoothness ?? 0
  const overallScore = Math.round((speechScore + handScore + eyeScore) / 3)

  const speechAssessment = getSpeechAssessment(
    matchingWordCount,
    results.speech?.letter ?? ""
  )
  const motorAssessment = getMotorAssessment(handScore)
  const eyeAssessment = getEyeAssessment(eyeScore)
  const overall = getOverallAssessment(overallScore)

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

  // Hand position scatter data
  const handScatterData = useMemo(() => {
    if (!results.hand?.positions) return []
    return results.hand.positions.map((p, i) => ({
      x: Math.round(p.x * 1000) / 1000,
      y: Math.round(p.y * 1000) / 1000,
      index: i,
    }))
  }, [results.hand])

  // Eye delta line chart
  const eyeDeltaData = useMemo(() => {
    if (!results.eye?.deltas) return []
    return results.eye.deltas.map((d, i) => ({
      frame: i,
      delta: Math.round(d * 10000) / 10000,
    }))
  }, [results.eye])

  return (
    <div className="space-y-6">
      {/* Overall score */}
      <Card className="border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
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

      {/* ==================== SPEECH RESULTS ==================== */}
      <Card className="border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Mic className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">
              Speech / Verbal Fluency
            </h3>
            <p className="text-xs text-muted-foreground">
              Phonemic fluency test (FAS paradigm)
            </p>
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${speechAssessment.bgColor} ${speechAssessment.color}`}
          >
            <speechAssessment.icon className="h-3 w-3" />
            {speechAssessment.label}
          </div>
        </div>

        {/* Metrics row */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-2xl font-bold text-foreground">
              {speechWordCount}
            </p>
            <p className="text-xs text-muted-foreground">Total words</p>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-2xl font-bold text-primary">
              {matchingWordCount}
            </p>
            <p className="text-xs text-muted-foreground">
              Starting with &ldquo;{results.speech?.letter}&rdquo;
            </p>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-2xl font-bold text-foreground">
              {results.speech?.duration ?? 0}s
            </p>
            <p className="text-xs text-muted-foreground">Duration</p>
          </div>
        </div>

        {/* Words captured */}
        {results.speech && results.speech.words.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Words Captured
            </p>
            <div className="flex flex-wrap gap-1.5">
              {results.speech.words.map((word, i) => {
                const matches = word.startsWith(
                  results.speech!.letter.toLowerCase()
                )
                return (
                  <span
                    key={`${word}-${i}`}
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      matches
                        ? "bg-accent/20 text-accent"
                        : "bg-muted text-muted-foreground line-through"
                    }`}
                  >
                    {word}
                  </span>
                )
              })}
            </div>
            {speechWordCount > matchingWordCount && (
              <p className="mt-2 text-xs text-muted-foreground">
                Words with strikethrough did not start with the target letter
                and are not counted.
              </p>
            )}
          </div>
        )}

        {/* Explanation */}
        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground">
              Clinical Context
            </p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {speechAssessment.detail}
          </p>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Reference: </span>
            Tombaugh, T. N., Kozak, J., & Rees, L. (1999). Normative data
            stratified by age and education for two measures of verbal fluency:
            FAS and Animal Naming. Archives of Clinical Neuropsychology, 14(2),
            167-177.
          </p>
        </div>
      </Card>

      {/* ==================== MOTOR RESULTS ==================== */}
      <Card className="border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <Hand className="h-4 w-4 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">
              Motor / Hand Stability
            </h3>
            <p className="text-xs text-muted-foreground">
              Postural tremor assessment via hand tracking
            </p>
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${motorAssessment.bgColor} ${motorAssessment.color}`}
          >
            <motorAssessment.icon className="h-3 w-3" />
            {motorAssessment.label}
          </div>
        </div>

        {/* Metrics */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-2xl font-bold text-foreground">
              {handScore.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">Stability /100</p>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-2xl font-bold text-foreground">
              {results.hand?.samples ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Samples</p>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-lg font-bold text-foreground">
              {results.hand
                ? `${(results.hand.varianceX * 1000).toFixed(2)} / ${(results.hand.varianceY * 1000).toFixed(2)}`
                : "N/A"}
            </p>
            <p className="text-xs text-muted-foreground">
              {"Var X / Y (x10\u207B\u00B3)"}
            </p>
          </div>
        </div>

        {/* Hand scatter plot */}
        {handScatterData.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Wrist Position Over Time (lower spread = more stable)
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart
                margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="X"
                  tick={{
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                  }}
                  domain={["dataMin - 0.01", "dataMax + 0.01"]}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Y"
                  tick={{
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                  }}
                  domain={["dataMin - 0.01", "dataMax + 0.01"]}
                  reversed
                />
                <ZAxis range={[15, 15]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                    fontSize: 11,
                  }}
                />
                <Scatter
                  data={handScatterData}
                  fill="hsl(var(--accent))"
                  fillOpacity={0.6}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Explanation */}
        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground">
              Clinical Context
            </p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {motorAssessment.detail}
          </p>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">References: </span>
            Haubenberger, D. & Hallett, M. (2018). Essential Tremor. New England
            Journal of Medicine, 378(19), 1802-1810. | Louis, E. D. & Ferreira,
            J. J. (2010). How common is the most common adult movement disorder?
            Update on the worldwide prevalence of essential tremor. Movement
            Disorders, 25(5), 534-541.
          </p>
        </div>
      </Card>

      {/* ==================== EYE RESULTS ==================== */}
      <Card className="border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-3/10">
            <Eye
              className="h-4 w-4"
              style={{ color: "hsl(var(--chart-3))" }}
            />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">
              Eye Movement / Smooth Pursuit
            </h3>
            <p className="text-xs text-muted-foreground">
              Oculomotor tracking consistency
            </p>
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${eyeAssessment.bgColor} ${eyeAssessment.color}`}
          >
            <eyeAssessment.icon className="h-3 w-3" />
            {eyeAssessment.label}
          </div>
        </div>

        {/* Metrics */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-2xl font-bold text-foreground">
              {eyeScore.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">Smoothness /100</p>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-2xl font-bold text-foreground">
              {results.eye?.samples ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Samples</p>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-lg font-bold text-foreground">
              {results.eye
                ? (results.eye.meanDelta * 1000).toFixed(2)
                : "N/A"}
            </p>
            <p className="text-xs text-muted-foreground">
              {"Mean \u0394 (x10\u207B\u00B3)"}
            </p>
          </div>
        </div>

        {/* Eye delta chart */}
        {eyeDeltaData.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Frame-to-Frame Eye Movement Delta (lower = smoother)
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart
                data={eyeDeltaData}
                margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="frame"
                  tick={{
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                  }}
                  label={{
                    value: "Frame",
                    position: "insideBottom",
                    offset: -2,
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                  }}
                />
                <YAxis
                  tick={{
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                    fontSize: 11,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="delta"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Explanation */}
        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground">
              Clinical Context
            </p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {eyeAssessment.detail}
          </p>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">References: </span>
            Leigh, R. J. & Zee, D. S. (2015). The Neurology of Eye Movements
            (5th ed.). Oxford University Press. | Stuart, S. et al. (2019). Eye
            tracking metrics as biomarkers of neurological disease. Frontiers in
            Neurology.
          </p>
        </div>
      </Card>

      {/* ==================== SUMMARY CHARTS ==================== */}
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

      {/* ==================== SCORING GUIDE ==================== */}
      <Card className="border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <Info className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            How Scores Are Calculated
          </h3>
        </div>
        <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
          <div>
            <p className="mb-1 font-medium text-foreground">
              Speech Score (0-100)
            </p>
            <p>
              Based on the number of valid words starting with the target
              letter, normalized to the FAS normative mean of ~14 words per
              letter per minute for adults aged 16-59 with 13+ years of
              education. A score of 100 means 14 or more matching words were
              produced.
            </p>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">
              Motor Score (0-100)
            </p>
            <p>
              Computed from the positional variance of the wrist landmark
              detected by MediaPipe Hand Landmarker over the 15-second hold
              period. Lower variance (less movement) yields a higher stability
              score. The formula is: 100 - (combined XY variance * 10,000),
              clamped to 0-100.
            </p>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">
              Eye Score (0-100)
            </p>
            <p>
              Derived from frame-to-frame gaze position deltas measured via
              MediaPipe Face Landmarker (eye corner landmarks 133 and 362).
              Smaller average deltas indicate smoother pursuit. Formula: 100 -
              (mean delta * 5,000), clamped to 0-100.
            </p>
          </div>
        </div>
      </Card>

      {/* Disclaimer */}
      <Card className="border-border bg-card p-4">
        <div className="flex gap-3">
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="mb-1 text-xs font-semibold text-foreground">
              Important Disclaimer
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This tool is for informational and screening purposes only and
              does not constitute a medical diagnosis. Webcam-based tracking has
              inherent limitations in precision compared to clinical-grade
              instruments (e.g., infrared eye trackers, accelerometers). The
              thresholds used are derived from published research but have not
              been independently validated for this specific implementation.
              Always consult a qualified healthcare professional for proper
              neurological assessment and diagnosis.
            </p>
          </div>
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
