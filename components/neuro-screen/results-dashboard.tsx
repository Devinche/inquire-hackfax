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
      plainExplanation: `You said ${matchingCount} matching words, which is close to average. Most people produce about 14 words per letter in one minute. Your score is within the typical range and suggests your verbal thinking skills are functioning normally. Factors like education level and age naturally affect this test.`,
      detail: `${matchingCount} matching words produced, within 1 standard deviation of the normative mean (~14 words/letter, SD ~5 for the FAS test). This is typical performance and reflects adequate frontal-executive function. Education and age account for ~29% of variance in FAS scores (Tombaugh et al., 1999).`,
    }
  }
  if (matchingCount >= 7) {
    return {
      label: "Borderline",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: AlertTriangle,
      plainExplanation: `You said ${matchingCount} matching words, which is somewhat below average. This could be due to many everyday factors like tiredness, distraction, stress, or simply not being familiar with this type of test. It does not necessarily mean anything is wrong, but if you notice other difficulties with thinking or memory, it may be worth discussing with a doctor.`,
      detail: `${matchingCount} matching words produced, 1-2 SDs below the normative mean. This may reflect fatigue, distraction, language factors, or lower education level. The FAS test is sensitive to frontal lobe dysfunction; Benton et al. (1994) established it as a key indicator in the COWAT battery. Clinical follow-up warranted if combined with other deficits.`,
    }
  }
  return {
    label: "Below Expected",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: AlertTriangle,
    plainExplanation: `You said ${matchingCount} matching words, which is significantly below what most people produce. This could be caused by many things, including language barriers, unfamiliarity with the test, extreme fatigue, or potential difficulties with word-finding and thinking speed. Consider talking to a healthcare professional, especially if you have noticed changes in your memory or thinking ability.`,
    detail: `${matchingCount} matching words produced, >2 SDs below normative expectations. Significantly reduced phonemic fluency is associated with frontal lobe dysfunction, Alzheimer's disease, traumatic brain injury, and Huntington's disease (Tombaugh et al., 1999). Strauss et al. (2006) note that scores this low warrant comprehensive neuropsychological evaluation. Lezak et al. (2012) emphasize that the FAS test is one of the most sensitive measures of frontal-subcortical circuit integrity.`,
  }
}

// Motor tremor:
// Haubenberger & Hallett (2018) - Essential Tremor review, NEJM
// Louis & Ferreira (2010) - ET prevalence (~4% of adults over 40)
// Deuschl et al. (1998/2018) - MDS consensus tremor classification (2-axis system)
// Elble (2003) - Physiological tremor: 8-12 Hz, <0.5mm amplitude in healthy adults
// Becktepe et al. (2025) - MediaPipe validation for tremor analysis
function getMotorAssessment(stability: number) {
  if (stability >= 85) {
    return {
      label: "Minimal Tremor",
      color: "text-accent",
      bgColor: "bg-accent/10",
      icon: CheckCircle2,
      plainExplanation: `Your hand stability score is ${stability.toFixed(1)} out of 100, which means your hand was very steady. Everyone has a tiny, invisible tremor in their hands (called physiological tremor), and your result is consistent with that normal baseline. Your motor control appears to be working well.`,
      detail: `Stability ${stability.toFixed(1)}/100 indicates minimal postural tremor, consistent with normal physiological tremor (8-12 Hz, amplitude <0.5mm per Elble, 2003). The MDS consensus classification (Deuschl et al., 2018) distinguishes this from pathological tremor syndromes. MediaPipe hand landmark variance at this level is near the noise floor of webcam-based detection (Becktepe et al., 2025).`,
    }
  }
  if (stability >= 70) {
    return {
      label: "Mild Tremor",
      color: "text-primary",
      bgColor: "bg-primary/10",
      icon: CheckCircle2,
      plainExplanation: `Your hand stability score is ${stability.toFixed(1)} out of 100, showing slight movement. This is very common and usually caused by everyday factors like caffeine, stress, tiredness, or even just being cold. This level of hand movement is generally not a medical concern and falls within the normal range for most people.`,
      detail: `Stability ${stability.toFixed(1)}/100 shows slight positional variation. Enhanced physiological tremor is common and influenced by caffeine, fatigue, stress, beta-adrenergic activation, or ambient temperature (Elble, 2003). The MDS task force (Deuschl et al., 2018) classifies this as within the physiological range unless accompanied by functional impairment. MediaPipe normalized landmarks show median estimation error of ~5mm (Becktepe et al., 2025).`,
    }
  }
  if (stability >= 50) {
    return {
      label: "Moderate Tremor",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: AlertTriangle,
      plainExplanation: `Your hand stability score is ${stability.toFixed(1)} out of 100, indicating noticeable hand movement during the test. This could be caused by anxiety, caffeine, medication side effects, or medical conditions such as essential tremor (which affects about 4% of adults over 40). If you regularly notice your hands shaking during everyday activities like writing or holding a cup, consider mentioning it to your doctor.`,
      detail: `Stability ${stability.toFixed(1)}/100 suggests elevated postural tremor. Enhanced physiological tremor can be caused by anxiety, hyperthyroidism, or medication side-effects. Essential tremor (ET) affects ~4% of adults over 40 (Louis & Ferreira, 2010) and presents as a postural/action tremor at 4-12 Hz. The 2018 MDS consensus classification recommends distinguishing ET from ET-plus and other action tremor syndromes. Logarithmic variance at this level exceeds the normal physiological range in webcam-based detection (Becktepe et al., 2025; Friedrich et al., 2024).`,
    }
  }
  return {
    label: "Elevated Tremor",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: AlertTriangle,
    plainExplanation: `Your hand stability score is ${stability.toFixed(1)} out of 100, indicating significant hand movement. While this could be due to test conditions (nervousness, cold hands, caffeine), consistent shaking at this level may be worth discussing with a healthcare professional. Common treatable causes include essential tremor, medication side effects, and thyroid issues. A doctor can perform a proper examination and determine if any follow-up is needed.`,
    detail: `Stability ${stability.toFixed(1)}/100 indicates significant postural tremor. Pathological tremor conditions include ET (4-12 Hz action tremor) and Parkinson's disease (3-6 Hz rest tremor, though postural tremor also occurs). Haubenberger & Hallett (2018, NEJM) review ET as the most common adult movement disorder. The MDS 2-axis classification (Deuschl et al., 2018) recommends clinical characterization followed by etiological investigation. Logarithmic variance at this level significantly exceeds the MediaPipe noise floor and is consistent with pathological tremor range (Becktepe et al., 2025).`,
  }
}

// Eye movement:
// Leigh & Zee (2015) - The Neurology of Eye Movements, 5th ed. (Oxford)
// Stuart et al. (2019) - Eye tracking metrics as biomarkers, Frontiers in Neurology
// Lencer & Trillenberg (2008) - Smooth pursuit in schizophrenia and affective disorders
// Benson et al. (2012) - Smooth pursuit deficits in early MS, Frontiers in Neurology
function getEyeAssessment(smoothness: number) {
  if (smoothness >= 80) {
    return {
      label: "Smooth Pursuit Normal",
      color: "text-accent",
      bgColor: "bg-accent/10",
      icon: CheckCircle2,
      plainExplanation: `Your eye smoothness score is ${smoothness.toFixed(1)} out of 100, meaning your eyes followed the moving dot steadily and consistently. This suggests the brain pathways that control smooth eye movements are functioning normally. Good eye tracking is a sign of healthy coordination between your brain and eye muscles.`,
      detail: `Smoothness ${smoothness.toFixed(1)}/100 indicates consistent, low-jitter eye movements. Normal smooth pursuit gain is >0.85 (Leigh & Zee, 2015). Minimal saccadic intrusions indicate intact oculomotor cerebellar-brainstem pathways. Stuart et al. (2019) validate that consistent eye tracking metrics correlate with healthy neurological function.`,
    }
  }
  if (smoothness >= 60) {
    return {
      label: "Mild Irregularity",
      color: "text-primary",
      bgColor: "bg-primary/10",
      icon: CheckCircle2,
      plainExplanation: `Your eye smoothness score is ${smoothness.toFixed(1)} out of 100, showing some variation in how your eyes followed the dot. This is common and can happen when you are tired, distracted, or the dot moves quickly. Small "jumps" in eye movement are normal, especially in a webcam-based test. This result is within the expected range.`,
      detail: `Smoothness ${smoothness.toFixed(1)}/100 shows some eye movement variability. Mild catch-up saccades during smooth pursuit are common and caused by inattention, fatigue, or target velocity changes. Leigh & Zee (2015) note that pursuit gain naturally decreases with target speeds >30 deg/s. This is within the expected range for a webcam-based assessment.`,
    }
  }
  if (smoothness >= 40) {
    return {
      label: "Moderate Irregularity",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: AlertTriangle,
      plainExplanation: `Your eye smoothness score is ${smoothness.toFixed(1)} out of 100, indicating your eyes had frequent small jumps instead of smooth tracking. This can be caused by tiredness, difficulty concentrating, or the limitations of webcam tracking. However, if you regularly have trouble focusing your eyes or notice jerky vision, it could be worth mentioning to an eye doctor or neurologist.`,
      detail: `Smoothness ${smoothness.toFixed(1)}/100 suggests frequent saccadic intrusions during pursuit. Benson et al. (2012) found that impaired smooth pursuit (gain <0.7) was an early marker of MS. Lencer & Trillenberg (2008) documented similar deficits in schizophrenia. However, webcam resolution limits precision; clinical VOG testing is recommended for confirmation.`,
    }
  }
  return {
    label: "Impaired Pursuit",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: AlertTriangle,
    plainExplanation: `Your eye smoothness score is ${smoothness.toFixed(1)} out of 100, indicating highly irregular eye movements with many jumps and corrections. While webcam-based tracking has limitations (lighting, camera quality, head movement can all affect results), consistently jerky eye movements may indicate issues with the brain areas controlling eye movement. Consider having a proper eye movement examination if you experience vision problems or dizziness.`,
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

// --- RECOMMENDATIONS ENGINE ---
function getRecommendations(
  overallScore: number,
  speechScore: number,
  handScore: number,
  eyeScore: number,
  matchingWords: number
) {
  const recs: Array<{
    title: string
    description: string
    type: "exercise" | "info" | "action" | "caution"
    icon: typeof Dumbbell
  }> = []

  // Speech-specific recommendations
  if (matchingWords < 7) {
    recs.push({
      title: "Practice Word-Finding Exercises",
      description:
        "Try daily word games like crossword puzzles, Scrabble, or word association games. Set a timer for 1 minute and practice naming words that start with a random letter. This type of practice can strengthen the neural pathways involved in word retrieval and verbal fluency.",
      type: "exercise",
      icon: Dumbbell,
    })
    recs.push({
      title: "Consider a Speech-Language Evaluation",
      description:
        "If you consistently struggle to find words in everyday conversation, or if friends and family have noticed changes in your speech, consider seeing a speech-language pathologist. They can conduct a thorough assessment and provide targeted exercises.",
      type: "action",
      icon: Stethoscope,
    })
  } else if (matchingWords < 10) {
    recs.push({
      title: "Boost Your Verbal Fluency",
      description:
        "Your word production is slightly below average. Try reading aloud for 10 minutes daily, practicing category naming (name all the animals you can think of in 1 minute), or learning a new word each day. Regular mental stimulation helps maintain and improve verbal fluency.",
      type: "exercise",
      icon: Dumbbell,
    })
  }

  // Motor-specific recommendations
  if (handScore < 50) {
    recs.push({
      title: "Consult a Doctor About Hand Tremor",
      description:
        "Significant hand tremor can have many treatable causes, including essential tremor, medication side effects, thyroid problems, or anxiety. A doctor can perform a physical exam, review your medications, and order blood tests if needed. Early evaluation helps rule out conditions that benefit from treatment.",
      type: "action",
      icon: Stethoscope,
    })
    recs.push({
      title: "Possible Causes of Hand Tremor",
      description:
        "Common causes include: essential tremor (the most common movement disorder, often runs in families), caffeine or stimulant use, anxiety or stress, certain medications (such as lithium, valproate, or some asthma inhalers), low blood sugar, thyroid overactivity, or fatigue. Less common causes include Parkinson's disease and other neurological conditions.",
      type: "info",
      icon: HeartPulse,
    })
  } else if (handScore < 70) {
    recs.push({
      title: "Hand Steadiness Exercises",
      description:
        "Try these exercises to improve hand stability: (1) Practice holding a full glass of water steady for 30 seconds, gradually increasing to 1 minute. (2) Thread a needle or do precision tasks like building with small blocks. (3) Practice writing slowly and deliberately. (4) Try hand stretches and gentle resistance exercises. Reducing caffeine and managing stress can also help.",
      type: "exercise",
      icon: Dumbbell,
    })
    recs.push({
      title: "Monitor Your Hand Steadiness",
      description:
        "Your tremor level is mildly elevated. Keep track of when it gets worse (after coffee, when stressed, when tired) and when it feels better. If the tremor is getting progressively worse or interfering with daily tasks like eating, writing, or using a phone, discuss it with your doctor.",
      type: "info",
      icon: HeartPulse,
    })
  }

  // Eye-specific recommendations
  if (eyeScore < 40) {
    recs.push({
      title: "Get an Eye Movement Examination",
      description:
        "Consistently irregular eye movements may warrant a professional evaluation. An ophthalmologist or neurologist can perform detailed eye movement testing (videonystagmography or VOG) that is far more precise than webcam-based tracking. This is especially important if you experience dizziness, double vision, or difficulty reading.",
      type: "action",
      icon: Stethoscope,
    })
    recs.push({
      title: "Possible Causes of Eye Movement Issues",
      description:
        "Irregular eye tracking can be caused by: fatigue or poor sleep, certain medications (anti-seizure drugs, sedatives), inner ear problems, vitamin deficiencies (B12, thiamine), neurological conditions, or simply the limitations of webcam-based testing. Many of these causes are treatable.",
      type: "info",
      icon: HeartPulse,
    })
  } else if (eyeScore < 60) {
    recs.push({
      title: "Eye Tracking Exercises",
      description:
        "Try these exercises to improve smooth eye movement: (1) Slowly move your finger side to side at arm's length and follow it with your eyes, not your head. Do this for 1 minute, twice daily. (2) Focus on a distant object, then a near object, alternating every 5 seconds. (3) Practice reading by following a pencil tip along each line of text. These exercises strengthen the eye muscles and brain coordination.",
      type: "exercise",
      icon: Dumbbell,
    })
  }

  // Overall recommendations
  if (overallScore < 40) {
    recs.push({
      title: "Schedule a General Health Check-Up",
      description:
        "Your overall scores suggest it may be worthwhile to discuss these results with your primary care doctor. Bring this report summary with you. Many common health conditions (thyroid issues, vitamin deficiencies, sleep problems, medication side effects) can affect motor control, eye movements, and thinking speed. A basic health check can identify and address treatable causes.",
      type: "caution",
      icon: ShieldAlert,
    })
  } else if (overallScore >= 80) {
    recs.push({
      title: "Keep Up the Good Work",
      description:
        "Your results are within normal limits across all three tests. To maintain your neurological health, continue with regular exercise (at least 150 minutes per week), adequate sleep (7-9 hours), a balanced diet rich in omega-3 fatty acids and antioxidants, and mentally stimulating activities like reading, puzzles, or learning new skills.",
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

  const speechScore = Math.min(100, Math.round((matchingWordCount / 14) * 100))
  const handScore = results.hand?.stability ?? 0
  const eyeScore = results.eye?.smoothness ?? 0
  const overallScore = Math.round((speechScore + handScore + eyeScore) / 3)

  const speechAssessment = getSpeechAssessment(matchingWordCount)
  const motorAssessment = getMotorAssessment(handScore)
  const eyeAssessment = getEyeAssessment(eyeScore)
  const overall = getOverallAssessment(overallScore)

  const recommendations = useMemo(
    () =>
      getRecommendations(
        overallScore,
        speechScore,
        handScore,
        eyeScore,
        matchingWordCount
      ),
    [overallScore, speechScore, handScore, eyeScore, matchingWordCount]
  )

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
              <p className="text-xs font-medium text-foreground">References</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tombaugh, T. N., Kozak, J., & Rees, L. (1999). Normative data
                stratified by age and education for two measures of verbal
                fluency: FAS and Animal Naming.{" "}
                <span className="italic">
                  Archives of Clinical Neuropsychology
                </span>
                , 14(2), 167-177. This study of 1,300 participants established
                the baseline of ~14 words per letter per minute for healthy
                adults, which is the benchmark we compare your score against.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Strauss, E., Sherman, E. M. S., & Spreen, O. (2006).{" "}
                <span className="italic">
                  A Compendium of Neuropsychological Tests
                </span>{" "}
                (3rd ed.). Oxford University Press. This comprehensive reference
                shows how verbal fluency norms vary by age and education level.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Lezak, M. D., Howieson, D. B., Bigler, E. D., & Tranel, D.
                (2012).{" "}
                <span className="italic">Neuropsychological Assessment</span>{" "}
                (5th ed.). Oxford University Press. This textbook explains how
                verbal fluency tests measure the frontal lobe's ability to
                organize and retrieve information quickly.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Benton, A. L., Hamsher, K. de S., & Sivan, A. B. (1994).{" "}
                <span className="italic">
                  Multilingual Aphasia Examination
                </span>{" "}
                (3rd ed.). AJA Associates. The original test battery that
                established this type of word-generation task as a clinical tool.
              </p>
            </div>
          </div>
        </details>
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

        {/* Plain language explanation */}
        <div className="mb-3 rounded-lg border border-accent/20 bg-accent/5 p-4">
          <p className="mb-1 text-xs font-semibold text-foreground">
            What This Means
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {motorAssessment.plainExplanation}
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
              {motorAssessment.detail}
            </p>
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-foreground">References</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Haubenberger, D. & Hallett, M. (2018). Essential Tremor.{" "}
                <span className="italic">
                  New England Journal of Medicine
                </span>
                , 378(19), 1802-1810. This review covers essential tremor, the
                most common movement disorder in adults, and explains how tremor
                is classified and treated.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Becktepe, J. et al. (2025). Validity of tremor analysis using
                smartphone compatible computer vision frameworks.{" "}
                <span className="italic">Scientific Reports</span>, 15, 13391.
                This study validated that MediaPipe can accurately detect tremor
                frequency, though amplitude estimation has a median error of
                ~5mm. Our logarithmic scoring is based on these findings.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Louis, E. D. & Ferreira, J. J. (2010). How common is the most
                common adult movement disorder?{" "}
                <span className="italic">Movement Disorders</span>, 25(5),
                534-541. Shows that essential tremor affects about 4% of adults
                over 40.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Deuschl, G. et al. (2018). The MDS consensus classification of
                tremor.{" "}
                <span className="italic">Movement Disorders</span>, 33(1),
                75-87. The international classification system doctors use to
                categorize different types of tremor.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Elble, R. J. (2003). Characteristics of physiologic tremor in
                young and elderly adults.{" "}
                <span className="italic">Clinical Neurophysiology</span>,
                114(4), 624-635. Establishes that normal physiological tremor
                is 8-12 Hz with very small amplitude (less than 0.5mm).
              </p>
            </div>
          </div>
        </details>
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

        {/* Plain language explanation */}
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
              {eyeAssessment.detail}
            </p>
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-foreground">References</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Leigh, R. J. & Zee, D. S. (2015).{" "}
                <span className="italic">
                  The Neurology of Eye Movements
                </span>{" "}
                (5th ed.). Oxford University Press. The gold-standard textbook on
                eye movements, explaining that normal smooth pursuit (following
                a moving target) should have a gain above 0.85, meaning your eyes
                keep up with at least 85% of the target's movement.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Stuart, S. et al. (2019). Eye tracking metrics as biomarkers of
                neurological disease.{" "}
                <span className="italic">Frontiers in Neurology</span>, 10,
                1387. Validates that eye tracking patterns can serve as early
                indicators of neurological conditions.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Lencer, R. & Trillenberg, P. (2008). Neurophysiology and
                neuroanatomy of smooth pursuit in humans.{" "}
                <span className="italic">Brain and Cognition</span>, 68(3),
                219-228. Shows that smooth pursuit dysfunction is one of the most
                reliable eye-movement markers in neuropsychiatric conditions.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Benson, L. A. et al. (2012). Smooth pursuit as an early marker
                of MS.{" "}
                <span className="italic">Frontiers in Neurology</span>, 3, 206.
                Found that impaired smooth pursuit (keeping eyes smoothly on a
                moving target) can be an early sign of multiple sclerosis.
              </p>
            </div>
          </div>
        </details>
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
              healthcare professional before starting any new exercise program or
              making health decisions based on these results.
            </p>
          </div>
        </Card>
      )}

      {/* SCORING GUIDE */}
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
            <p className="mb-2">
              We count how many words you said that start with the target letter,
              then compare that to the expected number for a healthy adult. Research
              shows that most people say about 14 matching words per letter in one
              minute.
            </p>
            <p className="mb-1 text-xs font-medium text-foreground">
              The formula:
            </p>
            <p className="text-xs">
              Your matching words (you said {matchingWordCount}) divided by 14
              (the research-based average), multiplied by 100. So:{" "}
              <span className="font-mono font-medium text-primary">
                {matchingWordCount} / 14 x 100 = {speechScore}
              </span>
              . A score of 100 means you said 14 or more matching words. Factors
              like education level (accounts for ~19% of score variation) and age
              (~11%) naturally affect performance.
            </p>
          </div>

          <div className="rounded-lg bg-secondary/50 p-4">
            <p className="mb-2 font-semibold text-foreground">
              Motor Score (0-100)
            </p>
            <p className="mb-2">
              We track your wrist position using your camera many times per second
              and measure how much it moves around. Less movement means better
              stability. The first 20% of the recording is ignored (settling
              period) because everyone needs a moment to get their hand in position.
            </p>
            <p className="mb-1 text-xs font-medium text-foreground">
              The formula:
            </p>
            <p className="text-xs">
              We calculate the spread (variance) of all your wrist positions, then
              apply a logarithmic scale. This is because tremor perception follows
              the Weber-Fechner law: doubling the tremor does not feel twice as bad.
              The score also includes a "worst segments" penalty, meaning that if your
              hand shook badly for any period, that permanently reduces the final score
              even if you held steady afterwards. This prevents artificially high scores.
              The formula:{" "}
              <span className="font-mono font-medium text-accent">
                {"score = (log10(variance) + 7) / 4.5 x 100"}
              </span>
              , blended with the worst 25% of 30-frame segments for realism.
            </p>
          </div>

          <div className="rounded-lg bg-secondary/50 p-4">
            <p className="mb-2 font-semibold text-foreground">
              Eye Score (0-100)
            </p>
            <p className="mb-2">
              We track the position of your eyes using facial landmarks from your
              camera and measure how smoothly they move from frame to frame. Smooth
              tracking produces small, consistent position changes. Jerky tracking
              produces large, sudden jumps called saccadic intrusions.
            </p>
            <p className="mb-1 text-xs font-medium text-foreground">
              The formula:
            </p>
            <p className="text-xs">
              We measure the average distance your eye position moves between each
              camera frame (called the "delta"), skip the first 20% of data for settling,
              then apply a logarithmic scale similar to the motor score. Like the motor
              score, it includes a worst-segments penalty so brief periods of jerky movement
              permanently affect the result. The formula:{" "}
              <span
                className="font-mono font-medium"
                style={{ color: "hsl(var(--chart-3))" }}
              >
                {"score = (log10(mean_delta) + 3.5) / -2.5 x 100"}
              </span>
              , blended with the worst 25% of 30-frame segments.
            </p>
          </div>

          <div className="rounded-lg bg-secondary/50 p-4">
            <p className="mb-2 font-semibold text-foreground">
              Overall Score
            </p>
            <p>
              The overall score is simply the average of all three individual scores:{" "}
              <span className="font-mono font-medium text-foreground">
                ({speechScore} + {Math.round(handScore)} + {Math.round(eyeScore)})
                / 3 = {overallScore}
              </span>
              . Each test contributes equally. A score of 80 or above is considered
              within normal limits, 60-79 is largely normal, 40-59 indicates some
              concerns, and below 40 suggests further evaluation may be helpful.
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
              inherent limitations compared to clinical-grade instruments
              (infrared eye trackers, accelerometers, clinical VOG). MediaPipe's
              amplitude estimation has a median error of ~5mm and is more reliable
              for frequency than amplitude (Becktepe et al., 2025). Thresholds
              are derived from published research but have not been independently
              validated for this specific implementation. Always consult a
              qualified healthcare professional for proper neurological assessment
              and diagnosis.
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
