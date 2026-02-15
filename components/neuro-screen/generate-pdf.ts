import type { AssessmentResults, StoredAssessment } from "./assessment-flow"
import { jsPDF } from "jspdf"

function computeScoresFromResults(results: AssessmentResults) {
  const matchingWordCount = results.speech
    ? results.speech.words.filter((w) =>
        w.startsWith(results.speech!.letter.toLowerCase())
      ).length
    : 0
  const speechSkipped = results.speech?.wasSkipped ?? false
  const handSkipped = results.hand?.wasSkipped ?? false
  const eyeSkipped = results.eye?.wasSkipped ?? false
  const speechScore = speechSkipped
    ? 0
    : Math.min(100, Math.round((matchingWordCount / 14) * 100))
  const handScore = handSkipped ? 0 : (results.hand?.stability ?? 0)
  const eyeScore = eyeSkipped ? 0 : (results.eye?.smoothness ?? 0)
  const activeScores = [
    ...(speechSkipped ? [] : [speechScore]),
    ...(handSkipped ? [] : [handScore]),
    ...(eyeSkipped ? [] : [eyeScore]),
  ]
  const overallScore =
    activeScores.length > 0
      ? Math.round(
          activeScores.reduce((s, v) => s + v, 0) / activeScores.length
        )
      : 0
  return {
    matchingWordCount,
    speechScore,
    handScore,
    eyeScore,
    overallScore,
    speechSkipped,
    handSkipped,
    eyeSkipped,
  }
}

function getOverallLabel(score: number) {
  if (score >= 80) return "Within Normal Limits"
  if (score >= 60) return "Largely Normal"
  if (score >= 40) return "Some Concerns Noted"
  return "Further Evaluation Recommended"
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export async function generateMedicalPDF(
  assessments: StoredAssessment[],
  patientName?: string,
  patientDOB?: string,
  doctorName?: string,
  notes?: string
) {
  try {
    console.log("Starting PDF generation for", assessments.length, "assessment(s)...")
    console.log("Creating jsPDF instance...")
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    console.log("jsPDF instance created successfully")
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  function checkPage(needed: number) {
    if (y + needed > 270) {
      doc.addPage()
      y = margin
    }
  }

  // -- Header --
  doc.setFillColor(15, 23, 42) // slate-900
  doc.rect(0, 0, pageWidth, 36, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text("INQUIRE", margin, 16)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text("Cognitive Assessment Report", margin, 23)
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    margin,
    29
  )
  doc.setFontSize(8)
  doc.text("CONFIDENTIAL MEDICAL DOCUMENT", pageWidth - margin, 29, {
    align: "right",
  })

  y = 44

  // -- Patient Info Box --
  doc.setDrawColor(200, 200, 200)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, "FD")
  doc.setTextColor(30, 41, 59)
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("PATIENT INFORMATION", margin + 4, y + 7)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(`Name: ${patientName || "________________"}`, margin + 4, y + 14)
  doc.text(
    `Date of Birth: ${patientDOB || "________________"}`,
    margin + contentWidth / 2,
    y + 14
  )
  doc.text(
    `Referring Physician: ${doctorName || "________________"}`,
    margin + 4,
    y + 21
  )
  doc.text(
    `Number of Assessments: ${assessments.length}`,
    margin + contentWidth / 2,
    y + 21
  )

  y += 34

  // -- For each assessment --
  assessments.forEach((assessment, idx) => {
    const scores = computeScoresFromResults(assessment.results)

    checkPage(80)

    // Assessment header
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(margin, y, contentWidth, 10, 1, 1, "F")
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text(
      `Assessment ${idx + 1} of ${assessments.length}`,
      margin + 4,
      y + 7
    )
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text(formatDate(assessment.timestamp), pageWidth - margin - 4, y + 7, {
      align: "right",
    })
    y += 15

    // Overall score box
    doc.setDrawColor(200, 200, 200)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, "FD")
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 41, 59)
    doc.text(`Overall Score: ${scores.overallScore}/100`, margin + 4, y + 6)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text(
      `Classification: ${getOverallLabel(scores.overallScore)}`,
      margin + 4,
      y + 11
    )
    y += 18

    // Speech section
    checkPage(30)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 41, 59)
    doc.text("1. Speech / Verbal Fluency (FAS/COWAT)", margin, y)
    y += 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    if (scores.speechSkipped) {
      doc.text("Status: Skipped", margin + 4, y)
      y += 5
    } else {
      doc.text(
        `Score: ${scores.speechScore}/100 | Matching Words: ${scores.matchingWordCount} | Target Letter: "${assessment.results.speech?.letter}"`,
        margin + 4,
        y
      )
      y += 5
      doc.text(
        `Duration: ${assessment.results.speech?.duration ?? 0}s | Total Words Spoken: ${assessment.results.speech?.words.length ?? 0}`,
        margin + 4,
        y
      )
      y += 5
      if ((assessment.results.speech?.restartCount ?? 0) > 0) {
        doc.text(
          `Test was restarted ${assessment.results.speech!.restartCount} time(s)`,
          margin + 4,
          y
        )
        y += 5
      }
      const repeatWords = assessment.results.speech?.repeatWords ?? {}
      if (Object.keys(repeatWords).length > 0) {
        doc.text(
          `Repeated words: ${Object.entries(repeatWords)
            .map(([w, c]) => `${w} (${c}x)`)
            .join(", ")}`,
          margin + 4,
          y
        )
        y += 5
      }
      doc.text(
        `Normative reference: ~14 words/letter/minute (Tombaugh et al., 1999)`,
        margin + 4,
        y
      )
      y += 5
    }
    y += 3

    // Motor section
    checkPage(25)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("2. Motor / Hand Stability (Postural Tremor)", margin, y)
    y += 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    if (scores.handSkipped) {
      doc.text("Status: Skipped", margin + 4, y)
      y += 5
    } else {
      doc.text(
        `Score: ${scores.handScore.toFixed(1)}/100 | Samples: ${assessment.results.hand?.samples ?? 0}`,
        margin + 4,
        y
      )
      y += 5
      doc.text(
        `Variance X: ${((assessment.results.hand?.varianceX ?? 0) * 1000).toFixed(3)} | Variance Y: ${((assessment.results.hand?.varianceY ?? 0) * 1000).toFixed(3)} (x10^-3)`,
        margin + 4,
        y
      )
      y += 5
      if ((assessment.results.hand?.restartCount ?? 0) > 0) {
        doc.text(
          `Test was restarted ${assessment.results.hand!.restartCount} time(s)`,
          margin + 4,
          y
        )
        y += 5
      }
    }
    y += 3

    // Eye section
    checkPage(25)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("3. Eye Movement / Smooth Pursuit", margin, y)
    y += 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    if (scores.eyeSkipped) {
      doc.text("Status: Skipped", margin + 4, y)
      y += 5
    } else {
      doc.text(
        `Score: ${scores.eyeScore.toFixed(1)}/100 | Samples: ${assessment.results.eye?.samples ?? 0}`,
        margin + 4,
        y
      )
      y += 5
      doc.text(
        `Gaze on Target: ${assessment.results.eye?.gazeOnTarget ?? 0}% | Mean Delta: ${(assessment.results.eye?.meanDelta ?? 0).toFixed(4)} | Max Delta: ${(assessment.results.eye?.maxDelta ?? 0).toFixed(4)}`,
        margin + 4,
        y
      )
      y += 5
      if ((assessment.results.eye?.restartCount ?? 0) > 0) {
        doc.text(
          `Test was restarted ${assessment.results.eye!.restartCount} time(s)`,
          margin + 4,
          y
        )
        y += 5
      }
    }
    y += 6

    // Separator between assessments
    if (idx < assessments.length - 1) {
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, y, pageWidth - margin, y)
      y += 6
    }
  })

  // -- Notes section --
  if (notes) {
    checkPage(30)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 41, 59)
    doc.text("ADDITIONAL NOTES", margin, y)
    y += 6
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    const splitNotes = doc.splitTextToSize(notes, contentWidth - 8)
    doc.text(splitNotes, margin + 4, y)
    y += splitNotes.length * 4 + 4
  }

  // -- Methodology section --
  checkPage(50)
  y += 4
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(30, 41, 59)
  doc.text("METHODOLOGY & LIMITATIONS", margin, y)
  y += 6
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105) // slate-500

  const methodology = [
    "Speech: Phonemic fluency test based on the FAS/COWAT paradigm. The patient is asked to name as many words as possible starting with a given letter within 60 seconds. Scoring is based on matching words relative to the normative mean of ~14 words/letter (Tombaugh et al., 1999).",
    "",
    "Motor: Postural tremor assessment via webcam-based hand tracking using MediaPipe. The patient holds their hand still for 15 seconds. Stability is computed from wrist landmark variance using RMS with a sigmoid scoring function. Median amplitude estimation error is ~5mm (Becktepe et al., 2025).",
    "",
    "Eye: Smooth pursuit assessment via webcam-based face landmark tracking using MediaPipe FaceLandmarker. The patient follows a moving dot for 15 seconds. Smoothness is computed from frame-to-frame gaze position deltas using iris-relative coordinates.",
    "",
    "IMPORTANT: This screening tool uses webcam-based tracking which has inherent limitations compared to clinical-grade instruments. Results should be interpreted as supplementary data only and do not constitute a medical diagnosis. A qualified healthcare professional should perform proper neurological assessment when indicated.",
  ]

  methodology.forEach((line) => {
    checkPage(8)
    if (line === "") {
      y += 2
    } else {
      const split = doc.splitTextToSize(line, contentWidth - 4)
      doc.text(split, margin + 2, y)
      y += split.length * 3.5 + 1
    }
  })

  // -- Signature area --
  checkPage(35)
  y += 8
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 10
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "normal")

  doc.text("Physician Signature: ________________________", margin, y)
  doc.text(
    "Date: ________________________",
    pageWidth - margin - 70,
    y
  )
  y += 10
  doc.text("Print Name: ________________________", margin, y)
  doc.text("License #: ________________________", pageWidth - margin - 70, y)

  // -- Footer --
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Inquire Cognitive Assessment Report | Page ${i} of ${pageCount} | Confidential`,
      pageWidth / 2,
      287,
      { align: "center" }
    )
  }

  // Save
  const dateStr = new Date().toISOString().split("T")[0]
  const name = patientName?.replace(/\s+/g, "_") || "patient"
  const filename = `Inquire_Assessment_${name}_${dateStr}.pdf`
  console.log("Saving PDF as:", filename)
  doc.save(filename)
  console.log("PDF saved successfully")
  } catch (error) {
    console.error("Error generating PDF:", error)
    throw error
  }
}
