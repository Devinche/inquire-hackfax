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
  Stethoscope,
  Dumbbell,
  ShieldAlert,
  HeartPulse,
  SkipForward,
  Repeat,
} from "lucide-react"
import type { AssessmentResults, StoredAssessment } from "./assessment-flow"

interface ResultsDashboardProps {
  results: AssessmentResults
  onRestart: () => void
  allHistory: StoredAssessment[]
}

// --- RESEARCH-BASED THRESHOLDS ---

function getSpeechAssessment(matchingCount: number) {
  if (matchingCount >= 14) {
    return {
      label: "Within Normal Range",
      color: "text-accent",
      bgColor: "bg-accent/10",
      icon: CheckCircle2,
      plainExplanation: `You said ${matchingCount} matching words, which is at or above what most healthy adults produce in this test. This suggests your brain's word-finding ability and quick thinking skills are working well.`,
      detail: `${matchingCount} matching words produced, at or above the normative mean for healthy adults aged 16-59 with 13+ years of education (M = 42.9 across F, A, S, ~14/letter). This indicates intact phonemic fluency, a measure of executive function, lexical retrieval, and frontal lobe processing speed (Tombaugh et al., 1999; Lezak et al., 2012).`,
    }
  }
  if (matchingCount >= 10) {
    return {
      label: "Good",
      color: "text-primary",
      bgColor: "bg-primary/10",
      icon: CheckCircle2,
      plainExplanation: `You said ${matchingCount} matching words, which is close to average. Most people produce about 14 words per letter in one minute. Your score is within the typical range and suggests your verbal thinking skills are functioning normally.`,
      detail: `${matchingCount} matching words produced, within 1 standard deviation of the normative mean (~14 words/letter, SD ~5 for the FAS test). This is typical performance and reflects adequate frontal-executive function. Education and age account for ~29% of variance in FAS scores (Tombaugh et al., 1999).`,
    }
  }
  if (matchingCount >= 7) {
    return {
      label: "Borderline",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: AlertTriangle,
      plainExplanation: `You said ${matchingCount} matching words, which is somewhat below average. This could be due to many everyday factors like tiredness, distraction, stress, or simply not being familiar with this type of test. It does not necessarily mean anything is wrong.`,
      detail: `${matchingCount} matching words produced, 1-2 SDs below the normative mean. This may reflect fatigue, distraction, language factors, or lower education level. The FAS test is sensitive to frontal lobe dysfunction; Benton et al. (1994) established it as a key indicator in the COWAT battery.`,
    }
  }
  return {
    label: "Below Expected",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: AlertTriangle,
    plainExplanation: `You said ${matchingCount} matching words, which is significantly below what most people produce. This could be caused by many things, including language barriers, unfamiliarity with the test, extreme fatigue, or potential difficulties with word-finding and thinking speed. Consider talking to a healthcare professional.`,
    detail: `${matchingCount} matching words produced, >2 SDs below normative expectations. Significantly reduced phonemic fluency is associated with frontal lobe dysfunction, Alzheimer's disease, traumatic brain injury, and Huntington's disease (Tombaugh et al., 1999; Strauss et al., 2006).`,
  }
}

function getMotorAssessment(stability: number) {
  if (stability >= 85) {
    return {
      label: "Minimal Tremor",
      color: "text-accent",
      bgColor: "bg-accent/10",
      icon: CheckCircle2,
      plainExplanation: `Your hand stability score is ${stability.toFixed(1)} out of 100, which means your hand was very steady. Everyone has a tiny, invisible tremor in their hands, and your result is consistent with that normal baseline.`,
      detail: `Stability ${stability.toFixed(1)}/100 indicates minimal postural tremor, consistent with normal physiological tremor (8-12 Hz, amplitude <0.5mm per Elble, 2003). MediaPipe hand landmark variance at this level is near the noise floor (Becktepe et al., 2025).`,
    }
  }
  if (stability >= 70) {
    return {
      label: "Mild Tremor",
      color: "text-primary",
      bgColor: "bg-primary/10",
      icon: CheckCircle2,
      plainExplanation: `Your hand stability score is ${stability.toFixed(1)} out of 100, showing slight movement. This is very common and usually caused by caffeine, stress, tiredness, or even just being cold. This level of hand movement is generally not a medical concern.`,
      detail: `Stability ${stability.toFixed(1)}/100 shows slight positional variation. Enhanced physiological tremor is common and influenced by caffeine, fatigue, or stress (Elble, 2003). The MDS task force (Deuschl et al., 2018) classifies this as within the physiological range.`,
    }
  }
  if (stability >= 50) {
    return {
      label: "Moderate Tremor",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: AlertTriangle,
      plainExplanation: `Your hand stability score is ${stability.toFixed(1)} out of 100, indicating noticeable hand movement during the test. This could be caused by anxiety, caffeine, medication side effects, or conditions such as essential tremor. If you regularly notice shaking, consider mentioning it to your doctor.`,
      detail: `Stability ${stability.toFixed(1)}/100 suggests elevated postural tremor. Essential tremor affects ~4% of adults over 40 (Louis & Ferreira, 2010) and presents at 4-12 Hz. Logarithmic variance exceeds the normal range (Becktepe et al., 2025).`,
    }
  }
  return {
    label: "Elevated Tremor",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: AlertTriangle,
    plainExplanation: `Your hand stability score is ${stability.toFixed(1)} out of 100, indicating significant hand movement. While this could be due to nervousness, cold hands, or caffeine, consistent shaking at this level may be worth discussing with a healthcare professional.`,
    detail: `Stability ${stability.toFixed(1)}/100 indicates significant postural tremor. Pathological tremor conditions include ET (4-12 Hz) and Parkinson's disease (3-6 Hz rest tremor). Haubenberger & Hallett (2018, NEJM) review ET as the most common adult movement disorder.`,
  }
}

function getEyeAssessment(smoothness: number) {
  if (smoothness >= 80) {
    return {
      label: "Smooth Pursuit Normal",
      color: "text-accent",
      bgColor: "bg-accent/10",
      icon: CheckCircle2,
      plainExplanation: `Your eye smoothness score is ${smoothness.toFixed(1)} out of 100, meaning your eyes followed the moving dot steadily and consistently. This suggests the brain pathways controlling smooth eye movements are functioning normally.`,
      detail: `Smoothness ${smoothness.toFixed(1)}/100 indicates consistent, low-jitter eye movements. Normal smooth pursuit gain is >0.85 (Leigh & Zee, 2015). Stuart et al. (2019) validate that consistent eye tracking metrics correlate with healthy neurological function.`,
    }
  }
  if (smoothness >= 60) {
    return {
      label: "Mild Irregularity",
      color: "text-primary",
      bgColor: "bg-primary/10",
      icon: CheckCircle2,
      plainExplanation: `Your eye smoothness score is ${smoothness.toFixed(1)} out of 100, showing some variation in how your eyes followed the dot. This is common when tired, distracted, or when the dot moves quickly. Small jumps in eye movement are normal.`,
      detail: `Smoothness ${smoothness.toFixed(1)}/100 shows some variability. Mild catch-up saccades during smooth pursuit are common with inattention or fatigue. Leigh & Zee (2015) note pursuit gain naturally decreases with target speeds >30 deg/s.`,
    }
  }
  if (smoothness >= 40) {
    return {
      label: "Moderate Irregularity",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: AlertTriangle,
      plainExplanation: `Your eye smoothness score is ${smoothness.toFixed(1)} out of 100, indicating your eyes had frequent small jumps instead of smooth tracking. This can be caused by tiredness, difficulty concentrating, or webcam limitations. If you regularly have trouble focusing, consider seeing an eye doctor.`,
      detail: `Smoothness ${smoothness.toFixed(1)}/100 suggests frequent saccadic intrusions during pursuit. Benson et al. (2012) found impaired smooth pursuit (gain <0.7) was an early marker of MS. Lencer & Trillenberg (2008) documented similar deficits in schizophrenia.`,
    }
  }
  return {
    label: "Impaired Pursuit",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: AlertTriangle,
    plainExplanation: `Your eye smoothness score is ${smoothness.toFixed(1)} out of 100, indicating highly irregular eye movements. While webcam tracking has limitations, consistently jerky eye movements may indicate issues worth checking. Consider a professional eye movement examination.`,
    detail: `Smoothness ${smoothness.toFixed(1)}/100 indicates significant saccadic intrusions. Saccadic pursuit (gain <0.5) has been observed in MS, cerebellar ataxia, and Parkinson's (Leigh & Zee, 2015; Stuart et al., 2019).`,
  }
}

function getOverallAssessment(score: number) {
  if (score >= 80) return { text: "Within Normal Limits", color: "text-accent" }
  if (score >= 60) return { text: "Largely Normal", color: "text-primary" }
  if (score >= 40)
    return { text: "Some Concerns Noted", color: "text-yellow-500" }
  return { text: "Further Evaluation Recommended", color: "text-destructive" }
}

// --- RECOMMENDATIONS ENGINE ---
function getRecommendations(
  overallScore: number,
  speechScore: number,
  handScore: number,
  eyeScore: number,
  matchingWords: number,
  hasRepeatWords: boolean,
  anySkipped: boolean
) {
  const recs: Array<{
    title: string
    description: string
    type: "exercise" | "info" | "action" | "caution"
    icon: typeof Dumbbell
  }> = []

  if (anySkipped) {
    recs.push({
      title: "Incomplete Assessment",
      description:
        "One or more tests were skipped, so the overall results may not give a complete picture. Consider running the full assessment when you have time for the most accurate results.",
      type: "info",
      icon: Info,
    })
  }

  // Speech-specific
  if (matchingWords < 7 && speechScore > 0) {
    recs.push({
      title: "Practice Word-Finding Exercises",
      description:
        "Try daily word games like crossword puzzles, Scrabble, or word association games. Set a timer for 1 minute and practice naming words that start with a random letter. This strengthens the neural pathways involved in word retrieval.",
      type: "exercise",
      icon: Dumbbell,
    })
    recs.push({
      title: "Consider a Speech-Language Evaluation",
      description:
        "If you consistently struggle to find words in conversation, or if others have noticed changes in your speech, consider seeing a speech-language pathologist for a thorough assessment.",
      type: "action",
      icon: Stethoscope,
    })
  } else if (matchingWords < 10 && speechScore > 0) {
    recs.push({
      title: "Boost Your Verbal Fluency",
      description:
        "Try reading aloud for 10 minutes daily, practicing category naming (name all the animals you can in 1 minute), or learning a new word each day. Regular mental stimulation helps maintain verbal fluency.",
      type: "exercise",
      icon: Dumbbell,
    })
  }

  if (hasRepeatWords) {
    recs.push({
      title: "Word Repetitions Were Detected",
      description:
        "You repeated some words during the speech test. Occasional repetition is normal, especially under time pressure. However, frequent repetition (called perseveration) can sometimes indicate difficulty generating new words. Practicing word games where you try to avoid repeats can help sharpen this skill.",
      type: "info",
      icon: Repeat,
    })
  }

  // Motor-specific
  if (handScore < 50 && handScore > 0) {
    recs.push({
      title: "Consult a Doctor About Hand Tremor",
      description:
        "Significant hand tremor can have many treatable causes, including essential tremor, medication side effects, thyroid problems, or anxiety. A doctor can perform a physical exam, review your medications, and order blood tests if needed.",
      type: "action",
      icon: Stethoscope,
    })
    recs.push({
      title: "Possible Causes of Hand Tremor",
      description:
        "Common causes include: essential tremor (the most common movement disorder, often hereditary), caffeine or stimulant use, anxiety, certain medications (lithium, valproate, some inhalers), low blood sugar, thyroid overactivity, or fatigue. Less common: Parkinson's disease and other neurological conditions.",
      type: "info",
      icon: HeartPulse,
    })
  } else if (handScore < 70 && handScore > 0) {
    recs.push({
      title: "Hand Steadiness Exercises",
      description:
        "Try: (1) Hold a full glass of water steady for 30 seconds, increasing to 1 minute. (2) Thread a needle or do precision tasks. (3) Practice writing slowly and deliberately. (4) Try hand stretches and gentle resistance exercises. Reducing caffeine and managing stress can also help.",
      type: "exercise",
      icon: Dumbbell,
    })
  }

  // Eye-specific
  if (eyeScore < 40 && eyeScore > 0) {
    recs.push({
      title: "Get an Eye Movement Examination",
      description:
        "Consistently irregular eye movements may warrant a professional evaluation. An ophthalmologist or neurologist can perform detailed eye movement testing far more precise than webcam-based tracking. This is especially important if you experience dizziness, double vision, or difficulty reading.",
      type: "action",
      icon: Stethoscope,
    })
    recs.push({
      title: "Possible Causes of Eye Movement Issues",
      description:
        "Irregular eye tracking can be caused by: fatigue, certain medications (anti-seizure drugs, sedatives), inner ear problems, vitamin deficiencies (B12, thiamine), neurological conditions, or simply webcam limitations. Many causes are treatable.",
      type: "info",
      icon: HeartPulse,
    })
  } else if (eyeScore < 60 && eyeScore > 0) {
    recs.push({
      title: "Eye Tracking Exercises",
      description:
        "Try: (1) Slowly move your finger side to side at arm's length and follow it with your eyes, not your head (1 minute, twice daily). (2) Focus on a distant object then a near one, alternating every 5 seconds. (3) Follow a pencil tip along lines of text. These strengthen eye muscles and brain coordination.",
      type: "exercise",
      icon: Dumbbell,
    })
  }

  // Overall
  if (overallScore < 40 && !anySkipped) {
    recs.push({
      title: "Schedule a General Health Check-Up",
      description:
        "Your overall scores suggest it may be worthwhile to discuss these results with your primary care doctor. Many common conditions (thyroid issues, vitamin deficiencies, sleep problems, medication side effects) can affect motor control, eye movements, and thinking speed.",
      type: "caution",
      icon: ShieldAlert,
    })
  } else if (overallScore >= 80) {
    recs.push({
      title: "Keep Up the Good Work",
      description:
        "Your results are within normal limits. To maintain neurological health: exercise regularly (150+ minutes/week), sleep 7-9 hours, eat a balanced diet rich in omega-3s and antioxidants, and stay mentally active with reading, puzzles, or learning new skills.",
      type: "info",
      icon: HeartPulse,
    })
  }

  return recs
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

  const speechSkipped = results.speech?.wasSkipped ?? false
  const handSkipped = results.hand?.wasSkipped ?? false
  const eyeSkipped = results.eye?.wasSkipped ?? false
  const anySkipped = speechSkipped || handSkipped || eyeSkipped

  const speechScore = speechSkipped
    ? 0
    : Math.min(100, Math.round((matchingWordCount / 14) * 100))
  const handScore = handSkipped ? 0 : (results.hand?.stability ?? 0)
  const eyeScore = eyeSkipped ? 0 : (results.eye?.smoothness ?? 0)

  // Only average non-skipped tests
  const activeScores = [
    ...(speechSkipped ? [] : [speechScore]),
    ...(handSkipped ? [] : [handScore]),
    ...(eyeSkipped ? [] : [eyeScore]),
  ]
  const overallScore =
    activeScores.length > 0
      ? Math.round(activeScores.reduce((s, v) => s + v, 0) / activeScores.length)
      : 0

  const speechAssessment = getSpeechAssessment(matchingWordCount)
  const motorAssessment = getMotorAssessment(handScore)
  const eyeAssessment = getEyeAssessment(eyeScore)
  const overall = getOverallAssessment(overallScore)

  // Repeat word analysis
  const repeatWords = results.speech?.repeatWords ?? {}
  const hasRepeatWords = Object.keys(repeatWords).length > 0
  const totalRepetitions = Object.values(repeatWords).reduce(
    (s, c) => s + (c - 1),
    0
  )

  const recommendations = useMemo(
    () =>
      getRecommendations(
        overallScore,
        speechScore,
        handScore,
        eyeScore,
        matchingWordCount,
        hasRepeatWords,
        anySkipped
      ),
    [overallScore, speechScore, handScore, eyeScore, matchingWordCount, hasRepeatWords, anySkipped]
  )

  const radarData = [
    { task: "Speech", score: speechSkipped ? 0 : speechScore, fullMark: 100 },
    { task: "Motor", score: handSkipped ? 0 : Math.round(handScore), fullMark: 100 },
    { task: "Eyes", score: eyeSkipped ? 0 : Math.round(eyeScore), fullMark: 100 },
  ]

  const barData = [
    { name: "Speech", score: speechSkipped ? 0 : speechScore, fill: "hsl(var(--primary))" },
    { name: "Motor", score: handSkipped ? 0 : Math.round(handScore), fill: "hsl(var(--accent))" },
    { name: "Eyes", score: eyeSkipped ? 0 : Math.round(eyeScore), fill: "hsl(var(--chart-3))" },
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

  const historicalComparison = useMemo(() => {
    if (allHistory.length < 2) return null
    const otherScores = allHistory.map((a) => {
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
          {anySkipped && (
            <p className="text-xs text-yellow-500">
              Some tests were skipped -- overall score based on completed tests only
            </p>
          )}
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
          {speechSkipped ? (
            <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              <SkipForward className="h-3 w-3" />
              Skipped
            </div>
          ) : (
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${speechAssessment.bgColor} ${speechAssessment.color}`}
            >
              <speechAssessment.icon className="h-3 w-3" />
              {speechAssessment.label}
            </div>
          )}
        </div>

        {speechSkipped ? (
          <p className="text-sm text-muted-foreground">
            This test was skipped. No speech data was collected.
          </p>
        ) : (
          <>
            {/* Test metadata */}
            {(results.speech?.restartCount ?? 0) > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-yellow-500/10 px-3 py-2 text-xs text-yellow-600">
                <RotateCcw className="h-3.5 w-3.5" />
                This test was restarted {results.speech!.restartCount} time
                {results.speech!.restartCount > 1 ? "s" : ""} before completion
              </div>
            )}

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
                    const isRepeat = (repeatWords[word] ?? 0) > 1
                    return (
                      <span
                        key={`${word}-${i}`}
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          isRepeat
                            ? "bg-yellow-500/20 text-yellow-600 ring-1 ring-yellow-500/30"
                            : matches
                              ? "bg-accent/20 text-accent"
                              : "bg-muted text-muted-foreground line-through"
                        }`}
                      >
                        {word}
                        {isRepeat && (
                          <span className="ml-1 text-yellow-500">
                            x{repeatWords[word]}
                          </span>
                        )}
                      </span>
                    )
                  })}
                </div>
                {speechWordCount > matchingWordCount && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Strikethrough words did not start with the target letter and
                    are excluded from scoring.
                  </p>
                )}
              </div>
            )}

            {/* Repeat word analysis */}
            {hasRepeatWords && (
              <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-yellow-500" />
                  <p className="text-sm font-semibold text-foreground">
                    Word Repetition Analysis
                  </p>
                </div>
                <p className="mb-2 text-sm text-muted-foreground leading-relaxed">
                  You repeated {Object.keys(repeatWords).length} word
                  {Object.keys(repeatWords).length > 1 ? "s" : ""} a total of{" "}
                  {totalRepetitions} extra time
                  {totalRepetitions > 1 ? "s" : ""} during the test.
                  Occasional repetition under time pressure is normal.
                  Frequent repetition (called perseveration in clinical
                  settings) can sometimes indicate difficulty generating new
                  words, which may relate to executive function.
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(repeatWords).map(([word, count]) => (
                    <span
                      key={word}
                      className="inline-flex items-center rounded-full bg-yellow-500/20 px-2.5 py-1 text-xs font-medium text-yellow-600"
                    >
                      {word}
                      <span className="ml-1.5 rounded-full bg-yellow-500/30 px-1.5 py-0.5 text-xs">
                        {count}x
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Plain language explanation */}
            <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="mb-1 text-xs font-semibold text-foreground">
                What This Means
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {speechAssessment.plainExplanation}
              </p>
            </div>

            {/* Clinical context */}
            <details className="group rounded-lg border border-border bg-secondary/50">
              <summary className="flex cursor-pointer items-center gap-2 p-4">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-foreground">
                  Clinical Context & References
                </p>
                <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
                  Show details
                </span>
                <span className="ml-auto hidden text-xs text-muted-foreground group-open:inline">
                  Hide details
                </span>
              </summary>
              <div className="border-t border-border px-4 pb-4 pt-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {speechAssessment.detail}
                </p>
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    References
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Tombaugh, T. N., Kozak, J., & Rees, L. (1999). Normative
                    data stratified by age and education for two measures of
                    verbal fluency.{" "}
                    <span className="italic">
                      Archives of Clinical Neuropsychology
                    </span>
                    , 14(2), 167-177. -- Established the ~14 words per letter
                    per minute benchmark we compare your score against.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Strauss, E., Sherman, E. M. S., & Spreen, O. (2006).{" "}
                    <span className="italic">
                      A Compendium of Neuropsychological Tests
                    </span>
                    . Oxford University Press. -- Shows how verbal fluency norms
                    vary by age and education level.
                  </p>
                </div>
              </div>
            </details>
          </>
        )}
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
          {handSkipped ? (
            <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              <SkipForward className="h-3 w-3" />
              Skipped
            </div>
          ) : (
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${motorAssessment.bgColor} ${motorAssessment.color}`}
            >
              <motorAssessment.icon className="h-3 w-3" />
              {motorAssessment.label}
            </div>
          )}
        </div>

        {handSkipped ? (
          <p className="text-sm text-muted-foreground">
            This test was skipped. No hand tracking data was collected.
          </p>
        ) : (
          <>
            {(results.hand?.restartCount ?? 0) > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-yellow-500/10 px-3 py-2 text-xs text-yellow-600">
                <RotateCcw className="h-3.5 w-3.5" />
                This test was restarted {results.hand!.restartCount} time
                {results.hand!.restartCount > 1 ? "s" : ""} before completion
              </div>
            )}

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

            <div className="mb-3 rounded-lg border border-accent/20 bg-accent/5 p-4">
              <p className="mb-1 text-xs font-semibold text-foreground">
                What This Means
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {motorAssessment.plainExplanation}
              </p>
            </div>

            <details className="group rounded-lg border border-border bg-secondary/50">
              <summary className="flex cursor-pointer items-center gap-2 p-4">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-foreground">
                  Clinical Context & References
                </p>
                <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
                  Show details
                </span>
                <span className="ml-auto hidden text-xs text-muted-foreground group-open:inline">
                  Hide details
                </span>
              </summary>
              <div className="border-t border-border px-4 pb-4 pt-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {motorAssessment.detail}
                </p>
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    References
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Becktepe, J. et al. (2025). Validity of tremor analysis
                    using smartphone compatible computer vision frameworks.{" "}
                    <span className="italic">Scientific Reports</span>, 15,
                    13391. -- Validated MediaPipe for tremor detection with
                    ~5mm amplitude estimation error.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Haubenberger, D. & Hallett, M. (2018). Essential Tremor.{" "}
                    <span className="italic">NEJM</span>, 378(19), 1802-1810.
                    -- Comprehensive review of the most common movement disorder
                    in adults.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Elble, R. J. (2003). Characteristics of physiologic tremor.{" "}
                    <span className="italic">Clinical Neurophysiology</span>,
                    114(4), 624-635. -- Establishes normal tremor is 8-12 Hz
                    with amplitude under 0.5mm.
                  </p>
                </div>
              </div>
            </details>
          </>
        )}
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
          {eyeSkipped ? (
            <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              <SkipForward className="h-3 w-3" />
              Skipped
            </div>
          ) : (
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${eyeAssessment.bgColor} ${eyeAssessment.color}`}
            >
              <eyeAssessment.icon className="h-3 w-3" />
              {eyeAssessment.label}
            </div>
          )}
        </div>

        {eyeSkipped ? (
          <p className="text-sm text-muted-foreground">
            This test was skipped. No eye tracking data was collected.
          </p>
        ) : (
          <>
            {(results.eye?.restartCount ?? 0) > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-yellow-500/10 px-3 py-2 text-xs text-yellow-600">
                <RotateCcw className="h-3.5 w-3.5" />
                This test was restarted {results.eye!.restartCount} time
                {results.eye!.restartCount > 1 ? "s" : ""} before completion
              </div>
            )}

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              <div className="rounded-lg bg-secondary p-3 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {results.eye?.gazeOnTarget ?? 0}%
                </p>
                <p className="text-xs text-muted-foreground">Gaze on target</p>
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

            <div
              className="mb-3 rounded-lg border p-4"
              style={{
                borderColor: "hsl(var(--chart-3) / 0.2)",
                backgroundColor: "hsl(var(--chart-3) / 0.05)",
              }}
            >
              <p className="mb-1 text-xs font-semibold text-foreground">
                What This Means
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {eyeAssessment.plainExplanation}
              </p>
              {(results.eye?.gazeOnTarget ?? 0) < 50 && (
                <p className="mt-2 text-xs text-yellow-500">
                  Note: Your gaze was on the target only{" "}
                  {results.eye?.gazeOnTarget ?? 0}% of the time. This can lower
                  the smoothness score and may be due to difficulty following the
                  dot, camera positioning, or glasses reflections.
                </p>
              )}
            </div>

            <details className="group rounded-lg border border-border bg-secondary/50">
              <summary className="flex cursor-pointer items-center gap-2 p-4">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-foreground">
                  Clinical Context & References
                </p>
                <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
                  Show details
                </span>
                <span className="ml-auto hidden text-xs text-muted-foreground group-open:inline">
                  Hide details
                </span>
              </summary>
              <div className="border-t border-border px-4 pb-4 pt-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {eyeAssessment.detail}
                </p>
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    References
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Leigh, R. J. & Zee, D. S. (2015).{" "}
                    <span className="italic">
                      The Neurology of Eye Movements
                    </span>{" "}
                    (5th ed.). Oxford University Press. -- Normal smooth pursuit
                    should maintain a gain above 0.85.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Stuart, S. et al. (2019). Eye tracking metrics as
                    biomarkers.{" "}
                    <span className="italic">Frontiers in Neurology</span>, 10,
                    1387. -- Validates eye tracking as an early neurological
                    indicator.
                  </p>
                </div>
              </div>
            </details>
          </>
        )}
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

      {/* RECOMMENDATIONS */}
      {recommendations.length > 0 && (
        <Card className="border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <HeartPulse className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Personalized Recommendations
              </h3>
              <p className="text-xs text-muted-foreground">
                Based on your scores, here is what you can do
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className={`rounded-lg border p-4 ${
                  rec.type === "caution"
                    ? "border-destructive/30 bg-destructive/5"
                    : rec.type === "action"
                      ? "border-yellow-500/30 bg-yellow-500/5"
                      : rec.type === "exercise"
                        ? "border-accent/30 bg-accent/5"
                        : "border-primary/30 bg-primary/5"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <rec.icon
                    className={`h-4 w-4 ${
                      rec.type === "caution"
                        ? "text-destructive"
                        : rec.type === "action"
                          ? "text-yellow-500"
                          : rec.type === "exercise"
                            ? "text-accent"
                            : "text-primary"
                    }`}
                  />
                  <p className="text-sm font-semibold text-foreground">
                    {rec.title}
                  </p>
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
                      rec.type === "caution"
                        ? "bg-destructive/10 text-destructive"
                        : rec.type === "action"
                          ? "bg-yellow-500/10 text-yellow-500"
                          : rec.type === "exercise"
                            ? "bg-accent/10 text-accent"
                            : "bg-primary/10 text-primary"
                    }`}
                  >
                    {rec.type === "caution"
                      ? "Important"
                      : rec.type === "action"
                        ? "Suggested Action"
                        : rec.type === "exercise"
                          ? "Exercise"
                          : "Information"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {rec.description}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              These recommendations are general guidance only and do not
              constitute medical advice or diagnosis. Always consult a qualified
              healthcare professional before making health decisions.
            </p>
          </div>
        </Card>
      )}

      {/* SCORING GUIDE (no formulas, just plain explanations) */}
      <Card className="border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <Info className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            How Scores Are Calculated
          </h3>
        </div>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <div className="rounded-lg bg-secondary/50 p-4">
            <p className="mb-2 font-semibold text-foreground">
              Speech Score (0-100)
            </p>
            <p>
              We count how many words you said that start with the target letter,
              then compare that to the expected number for a healthy adult.
              Research shows most people say about 14 matching words per letter
              in one minute. Your {matchingWordCount} matching words give you a
              score of {speechScore}. A score of 100 means you said 14 or more
              matching words.
            </p>
          </div>

          <div className="rounded-lg bg-secondary/50 p-4">
            <p className="mb-2 font-semibold text-foreground">
              Motor Score (0-100)
            </p>
            <p>
              We track your wrist position using the camera many times per second
              and measure how much it moves from its average position. Less
              movement means better stability. The first 20% of the recording is
              ignored (settling period) because everyone needs a moment to
              position their hand. If your hand shook badly during any period,
              that pulls the final score down permanently so it stays realistic.
              A steady hand scores near 100, while significant shaking pushes
              toward 0.
            </p>
          </div>

          <div className="rounded-lg bg-secondary/50 p-4">
            <p className="mb-2 font-semibold text-foreground">
              Eye Score (0-100)
            </p>
            <p>
              We track the position of your eyes using facial landmarks from the
              camera and measure how smoothly they move between frames. Smooth
              tracking produces small, consistent position changes. Jerky
              tracking produces sudden jumps. Like the motor score, the first 20%
              is excluded for settling, and bad periods permanently affect the
              result. The system also works with glasses by using multiple eye
              reference points.
            </p>
          </div>

          <div className="rounded-lg bg-secondary/50 p-4">
            <p className="mb-2 font-semibold text-foreground">Overall Score</p>
            <p>
              The overall score is the average of all completed test scores
              {anySkipped
                ? " (skipped tests are excluded from the average)"
                : ""}
              . A score of 80+ is within normal limits, 60-79 is largely normal,
              40-59 indicates some concerns, and below 40 suggests further
              evaluation may be helpful.
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
              This tool is for informational and screening purposes only and does
              not constitute a medical diagnosis. Webcam-based tracking has
              inherent limitations compared to clinical-grade instruments.
              MediaPipe's amplitude estimation has a median error of ~5mm
              (Becktepe et al., 2025). Always consult a qualified healthcare
              professional for proper neurological assessment.
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
