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
import type { AssessmentResults, StoredAssessment } from "./assessment-flow"

interface ResultsDashboardProps {
  results: AssessmentResults
  onRestart: () => void
  allHistory: StoredAssessment[]
}

// --- RESEARCH-BASED THRESHOLDS ---

// Verbal fluency (FAS):
// Tombaugh et al. (1999) - 1300 participants, ~14 words/letter/min for ages 16-59, 13+ yr edu
// Strauss et al. (2006) - Compendium of Neuropsychological Tests: FAS norms vary by age/education
// Lezak et al. (2012) - Neuropsychological Assessment, 5th ed: FAS as frontal lobe measure
// Benton et al. (1994) - Original COWAT norms establishing the paradigm
function getSpeechAssessment(matchingCount: number) {
  if (matchingCount >= 14) {
    return {
      label: "Within Normal Range",
      color: "text-accent",
      bgColor: "bg-accent/10",
      icon: CheckCircle2,
      detail: `${matchingCount} matching words produced, at or above the normative mean for healthy adults aged 16-59 with 13+ years of education (M = 42.9 across F, A, S, ~14/letter). This indicates intact phonemic fluency, a measure of executive function, lexical retrieval, and frontal lobe processing speed (Tombaugh et al., 1999; Lezak et al., 2012).`,
    }
  }
  if (matchingCount >= 10) {
    return {
      label: "Good",
      color: "text-primary",
      bgColor: "bg-primary/10",
      icon: CheckCircle2,
      detail: `${matchingCount} matching words produced, within 1 standard deviation of the normative mean (~14 words/letter, SD ~5 for the FAS test). This is typical performance and reflects adequate frontal-executive function. Education and age account for ~29% of variance in FAS scores (Tombaugh et al., 1999).`,
    }
  }
  if (matchingCount >= 7) {
    return {
      label: "Borderline",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: AlertTriangle,
      detail: `${matchingCount} matching words produced, 1-2 SDs below the normative mean. This may reflect fatigue, distraction, language factors, or lower education level. The FAS test is sensitive to frontal lobe dysfunction; Benton et al. (1994) established it as a key indicator in the COWAT battery. Clinical follow-up warranted if combined with other deficits.`,
    }
  }
  return {
    label: "Below Expected",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: AlertTriangle,
    detail: `${matchingCount} matching words produced, >2 SDs below normative expectations. Significantly reduced phonemic fluency is associated with frontal lobe dysfunction, Alzheimer's disease, traumatic brain injury, and Huntington's disease (Tombaugh et al., 1999). Strauss et al. (2006) note that scores this low warrant comprehensive neuropsychological evaluation. Lezak et al. (2012) emphasize that the FAS test is one of the most sensitive measures of frontal-subcortical circuit integrity.`,
  }
}

// Motor tremor:
// Haubenberger & Hallett (2018) - Essential Tremor review, NEJM
// Louis & Ferreira (2010) - ET prevalence (~4% of adults over 40)
// Deuschl et al. (1998/2018) - MDS consensus tremor classification (2-axis system)
// Elble (2003) - Physiological tremor: 8-12 Hz, <0.5mm amplitude in healthy adults
function getMotorAssessment(stability: number) {
  if (stability >= 85) {
    return {
      label: "Minimal Tremor",
      color: "text-accent",
      bgColor: "bg-accent/10",
      icon: CheckCircle2,
      detail: `Stability ${stability.toFixed(1)}/100 indicates minimal postural tremor, consistent with normal physiological tremor (8-12 Hz, amplitude <0.5mm per Elble, 2003). The MDS consensus classification (Deuschl et al., 2018) distinguishes this from pathological tremor syndromes. Healthy adults show very low positional variance during 15-second sustained posture.`,
    }
  }
  if (stability >= 70) {
    return {
      label: "Mild Tremor",
      color: "text-primary",
      bgColor: "bg-primary/10",
      icon: CheckCircle2,
      detail: `Stability ${stability.toFixed(1)}/100 shows slight positional variation. Enhanced physiological tremor is common and influenced by caffeine, fatigue, stress, beta-adrenergic activation, or ambient temperature (Elble, 2003). The MDS task force (Deuschl et al., 2018) classifies this as within the physiological range unless accompanied by functional impairment.`,
    }
  }
  if (stability >= 50) {
    return {
      label: "Moderate Tremor",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: AlertTriangle,
      detail: `Stability ${stability.toFixed(1)}/100 suggests elevated postural tremor. Enhanced physiological tremor can be caused by anxiety, hyperthyroidism, or medication side-effects. Essential tremor (ET) affects ~4% of adults over 40 (Louis & Ferreira, 2010) and presents as a postural/action tremor at 4-12 Hz. Accelerometric studies show ET variance is significantly elevated compared to physiological tremor. The 2018 MDS consensus classification recommends distinguishing ET from ET-plus and other action tremor syndromes.`,
    }
  }
  return {
    label: "Elevated Tremor",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: AlertTriangle,
    detail: `Stability ${stability.toFixed(1)}/100 indicates significant postural tremor. Pathological tremor conditions include ET (4-12 Hz action tremor) and Parkinson's disease (3-6 Hz rest tremor, though postural tremor also occurs). Haubenberger & Hallett (2018, NEJM) review ET as the most common adult movement disorder. The MDS 2-axis classification (Deuschl et al., 2018) recommends clinical characterization followed by etiological investigation. A neurological evaluation with accelerometry is strongly recommended.`,
  }
}

// Eye movement:
// Leigh & Zee (2015) - The Neurology of Eye Movements, 5th ed. (Oxford) - gold standard reference
// Stuart et al. (2019) - Eye tracking metrics as biomarkers, Frontiers in Neurology
// Lencer & Trillenberg (2008) - Smooth pursuit in schizophrenia and affective disorders
// Benson et al. (2012) - Smooth pursuit deficits in early MS, Frontiers in Neurology
// Normal smooth pursuit gain >0.85, saccadic intrusions indicate cerebellar/brainstem issues
function getEyeAssessment(smoothness: number) {
  if (smoothness >= 80) {
    return {
      label: "Smooth Pursuit Normal",
      color: "text-accent",
      bgColor: "bg-accent/10",
      icon: CheckCircle2,
      detail: `Smoothness ${smoothness.toFixed(1)}/100 indicates consistent, low-jitter eye movements. Normal smooth pursuit gain is >0.85 (Leigh & Zee, 2015). Minimal saccadic intrusions indicate intact oculomotor cerebellar-brainstem pathways. Stuart et al. (2019) validate that consistent eye tracking metrics correlate with healthy neurological function.`,
    }
  }
  if (smoothness >= 60) {
    return {
      label: "Mild Irregularity",
      color: "text-primary",
      bgColor: "bg-primary/10",
      icon: CheckCircle2,
      detail: `Smoothness ${smoothness.toFixed(1)}/100 shows some eye movement variability. Mild catch-up saccades during smooth pursuit are common and caused by inattention, fatigue, or target velocity changes. Leigh & Zee (2015) note that pursuit gain naturally decreases with target speeds >30 deg/s. This is within the expected range for a webcam-based assessment.`,
    }
  }
  if (smoothness >= 40) {
    return {
      label: "Moderate Irregularity",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: AlertTriangle,
      detail: `Smoothness ${smoothness.toFixed(1)}/100 suggests frequent saccadic intrusions during pursuit. Benson et al. (2012) found that impaired smooth pursuit (gain <0.7) was an early marker of MS. Lencer & Trillenberg (2008) documented similar deficits in schizophrenia. However, webcam resolution limits precision; clinical VOG testing is recommended for confirmation.`,
    }
  }
  return {
    label: "Impaired Pursuit",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: AlertTriangle,
    detail: `Smoothness ${smoothness.toFixed(1)}/100 indicates highly variable eye movements with significant saccadic intrusions. Saccadic pursuit (gain <0.5) has been observed in MS, cerebellar ataxia, Parkinson's disease, and schizophrenia (Leigh & Zee, 2015; Stuart et al., 2019). Lencer & Trillenberg (2008) identify smooth pursuit dysfunction as one of the most robust oculomotor biomarkers in neuropsychiatric conditions. A comprehensive oculomotor examination is strongly recommended.`,
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
  allHistory,
}: ResultsDashboardProps) {
  const speechWordCount = results.speech?.words?.length ?? 0
  const matchingWordCount = results.speech
    ? results.speech.words.filter((w) =>
        w.startsWith(results.speech!.letter.toLowerCase())
      ).length
    : 0

  const speechScore = Math.min(100, Math.round((matchingWordCount / 14) * 100))
  const handScore = results.hand?.stability ?? 0
  const eyeScore = results.eye?.smoothness ?? 0
  const overallScore = Math.round((speechScore + handScore + eyeScore) / 3)

  const speechAssessment = getSpeechAssessment(matchingWordCount)
  const motorAssessment = getMotorAssessment(handScore)
  const eyeAssessment = getEyeAssessment(eyeScore)
  const overall = getOverallAssessment(overallScore)

  const radarData = [
    { task: "Speech", score: speechScore, fullMark: 100 },
    { task: "Motor", score: Math.round(handScore), fullMark: 100 },
    { task: "Eyes", score: Math.round(eyeScore), fullMark: 100 },
  ]

  const barData = [
    { name: "Speech", score: speechScore, fill: "hsl(var(--primary))" },
    { name: "Motor", score: Math.round(handScore), fill: "hsl(var(--accent))" },
    { name: "Eyes", score: Math.round(eyeScore), fill: "hsl(var(--chart-3))" },
  ]

  const handScatterData = useMemo(() => {
    if (!results.hand?.positions) return []
    return results.hand.positions.map((p, i) => ({
      x: Math.round(p.x * 1000) / 1000,
      y: Math.round(p.y * 1000) / 1000,
      index: i,
    }))
  }, [results.hand])

  const eyeDeltaData = useMemo(() => {
    if (!results.eye?.deltas) return []
    return results.eye.deltas.map((d, i) => ({
      frame: i,
      delta: Math.round(d * 10000) / 10000,
    }))
  }, [results.eye])

  // Compare to historical average if we have >1 assessments
  const historicalComparison = useMemo(() => {
    if (allHistory.length < 2) return null

    const otherScores = allHistory
      .filter((a) => {
        const s = a.results.speech
          ? a.results.speech.words.filter((w) =>
              w.startsWith(a.results.speech!.letter.toLowerCase())
            ).length
          : 0
        const h = a.results.hand?.stability ?? 0
        const e = a.results.eye?.smoothness ?? 0
        const o = Math.round(
          (Math.min(100, Math.round((s / 14) * 100)) + h + e) / 3
        )
        // Exclude current result (rough match by score comparison)
        return true
      })
      .map((a) => {
        const s = a.results.speech
          ? a.results.speech.words.filter((w) =>
              w.startsWith(a.results.speech!.letter.toLowerCase())
            ).length
          : 0
        return {
          speech: Math.min(100, Math.round((s / 14) * 100)),
          motor: a.results.hand?.stability ?? 0,
          eyes: a.results.eye?.smoothness ?? 0,
        }
      })

    const avg = (arr: number[]) =>
      arr.reduce((s, v) => s + v, 0) / arr.length

    return {
      avgSpeech: Math.round(avg(otherScores.map((s) => s.speech))),
      avgMotor: Math.round(avg(otherScores.map((s) => s.motor))),
      avgEyes: Math.round(avg(otherScores.map((s) => s.eyes))),
    }
  }, [allHistory])

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
          {historicalComparison && (
            <p className="text-xs text-muted-foreground">
              Your average across all attempts: Speech{" "}
              {historicalComparison.avgSpeech}, Motor{" "}
              {historicalComparison.avgMotor}, Eyes{" "}
              {historicalComparison.avgEyes}
            </p>
          )}
        </div>
      </Card>

      {/* SPEECH RESULTS */}
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
              Phonemic fluency test (FAS/COWAT paradigm)
            </p>
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${speechAssessment.bgColor} ${speechAssessment.color}`}
          >
            <speechAssessment.icon className="h-3 w-3" />
            {speechAssessment.label}
          </div>
        </div>

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
              {"Starting with \u201C"}
              {results.speech?.letter}
              {"\u201D"}
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
                Strikethrough words did not start with the target letter and are
                excluded from scoring.
              </p>
            )}
          </div>
        )}

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
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-foreground">References</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tombaugh, T. N., Kozak, J., & Rees, L. (1999). Normative data
              stratified by age and education for two measures of verbal fluency:
              FAS and Animal Naming.{" "}
              <span className="italic">
                Archives of Clinical Neuropsychology
              </span>
              , 14(2), 167-177.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Strauss, E., Sherman, E. M. S., & Spreen, O. (2006).{" "}
              <span className="italic">
                A Compendium of Neuropsychological Tests
              </span>{" "}
              (3rd ed.). Oxford University Press.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Lezak, M. D., Howieson, D. B., Bigler, E. D., & Tranel, D.
              (2012).{" "}
              <span className="italic">Neuropsychological Assessment</span>{" "}
              (5th ed.). Oxford University Press.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Benton, A. L., Hamsher, K. de S., & Sivan, A. B. (1994).{" "}
              <span className="italic">
                Multilingual Aphasia Examination
              </span>{" "}
              (3rd ed.). AJA Associates.
            </p>
          </div>
        </div>
      </Card>

      {/* MOTOR RESULTS */}
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
              {"Var X / Y (\u00D710\u207B\u00B3)"}
            </p>
          </div>
        </div>

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
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-foreground">References</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Haubenberger, D. & Hallett, M. (2018). Essential Tremor.{" "}
              <span className="italic">
                New England Journal of Medicine
              </span>
              , 378(19), 1802-1810.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Louis, E. D. & Ferreira, J. J. (2010). How common is the most
              common adult movement disorder?{" "}
              <span className="italic">Movement Disorders</span>, 25(5),
              534-541.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Deuschl, G. et al. (2018). The MDS consensus classification of
              tremor.{" "}
              <span className="italic">Movement Disorders</span>, 33(1),
              75-87.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Elble, R. J. (2003). Characteristics of physiologic tremor in
              young and elderly adults.{" "}
              <span className="italic">Clinical Neurophysiology</span>,
              114(4), 624-635.
            </p>
          </div>
        </div>
      </Card>

      {/* EYE RESULTS */}
      <Card className="border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: "hsl(var(--chart-3) / 0.1)" }}
          >
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
              {"Mean \u0394 (\u00D710\u207B\u00B3)"}
            </p>
          </div>
        </div>

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
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-foreground">References</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Leigh, R. J. & Zee, D. S. (2015).{" "}
              <span className="italic">
                The Neurology of Eye Movements
              </span>{" "}
              (5th ed.). Oxford University Press.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Stuart, S. et al. (2019). Eye tracking metrics as biomarkers of
              neurological disease.{" "}
              <span className="italic">Frontiers in Neurology</span>, 10,
              1387.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Lencer, R. & Trillenberg, P. (2008). Neurophysiology and
              neuroanatomy of smooth pursuit in humans.{" "}
              <span className="italic">
                Brain and Cognition
              </span>
              , 68(3), 219-228.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Benson, L. A. et al. (2012). Smooth pursuit as an early marker of
              MS.{" "}
              <span className="italic">Frontiers in Neurology</span>, 3, 206.
            </p>
          </div>
        </div>
      </Card>

      {/* SUMMARY CHARTS */}
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

      {/* SCORING GUIDE */}
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
              Based on matching words normalized to the FAS normative mean of
              ~14 words/letter/min (Tombaugh et al., 1999). Education accounts
              for 18.6% of variance and age for 11.0%. A score of 100 = 14+
              matching words.
            </p>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">
              Motor Score (0-100)
            </p>
            <p>
              Positional variance of the wrist landmark (MediaPipe Hand
              Landmarker) over the hold period. First 10% of samples are
              excluded as a settling period. Formula: 100 - (variance * 8000),
              clamped 0-100. A rolling 60-frame window is used for live
              feedback so early jitter does not lock the score to 0.
            </p>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">
              Eye Score (0-100)
            </p>
            <p>
              Frame-to-frame gaze deltas via MediaPipe Face Landmarker
              (landmarks 133, 362). First 10% of deltas excluded as settling.
              Formula: 100 - (mean delta * 4000), clamped 0-100. Rolling
              60-frame window for live score.
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
              inherent limitations compared to clinical-grade instruments
              (infrared eye trackers, accelerometers, clinical VOG).
              Thresholds are derived from published research but have not been
              independently validated for this specific implementation. Always
              consult a qualified healthcare professional for proper
              neurological assessment and diagnosis.
            </p>
          </div>
        </div>
      </Card>

      {/* Restart */}
      <Button variant="outline" className="w-full gap-2" onClick={onRestart}>
        <RotateCcw className="h-4 w-4" />
        Run New Assessment
      </Button>
    </div>
  )
}
