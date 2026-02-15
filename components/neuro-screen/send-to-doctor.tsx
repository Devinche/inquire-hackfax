"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ChevronLeft,
  FileText,
  Download,
  Loader2,
} from "lucide-react"
import type { AssessmentResults, StoredAssessment } from "./assessment-flow"
import { generateMedicalPDF } from "./generate-pdf"

interface SendToDoctorProps {
  results: AssessmentResults
  allHistory: StoredAssessment[]
  timestamp?: number
  onBack: () => void
  selectedAssessments?: StoredAssessment[]
}

export function SendToDoctor({
  results,
  allHistory,
  timestamp,
  onBack,
  selectedAssessments,
}: SendToDoctorProps) {
  const [patientName, setPatientName] = useState("")
  const [patientDOB, setPatientDOB] = useState("")
  const [doctorName, setDoctorName] = useState("")
  const [notes, setNotes] = useState("")
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use selected assessments if provided, otherwise use current assessment
  const assessmentsToSend: StoredAssessment[] = selectedAssessments && selectedAssessments.length > 0
    ? selectedAssessments
    : allHistory.length > 0
    ? [allHistory[0]]
    : [{
        id: crypto.randomUUID(),
        timestamp: timestamp ?? Date.now(),
        results,
      }]
  
  console.log("SendToDoctor - selectedAssessments:", selectedAssessments)
  console.log("SendToDoctor - assessmentsToSend:", assessmentsToSend.length, "assessment(s)")

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      console.log("Generating PDF for", assessmentsToSend.length, "assessment(s)")
      await generateMedicalPDF(
        assessmentsToSend,
        patientName || undefined,
        patientDOB || undefined,
        doctorName || undefined,
        notes || undefined
      )
      setGenerated(true)
      console.log("PDF generation completed successfully")
    } catch (err) {
      console.error("PDF generation error:", err)
      setError(err instanceof Error ? err.message : "Failed to generate PDF. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

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
          Back
        </Button>
      </div>

      {/* Heading */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <FileText className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground text-balance">
          Send to Doctor
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
          Generate a professional medical PDF report of {assessmentsToSend.length === 1 ? 'your assessment' : `${assessmentsToSend.length} assessments`}.
          Fill in the optional fields below for a more complete report.
        </p>
      </div>

      {/* Form */}
      <Card className="w-full max-w-lg border-border bg-card p-6">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="patientName">Patient Name</Label>
              <Input
                id="patientName"
                placeholder="Full name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patientDOB">Date of Birth</Label>
              <Input
                id="patientDOB"
                type="date"
                value={patientDOB}
                onChange={(e) => setPatientDOB(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doctorName">Referring Physician</Label>
            <Input
              id="doctorName"
              placeholder="Doctor's name"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any symptoms, medications, or relevant medical history..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              All fields are optional. The PDF will include your assessment
              scores, methodology details, and a signature area for the
              reviewing physician.
            </p>
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : generated ? (
              <>
                <Download className="h-4 w-4" />
                Download Again
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Generate & Download PDF
              </>
            )}
          </Button>

          {generated && (
            <p className="text-center text-sm text-accent">
              PDF has been downloaded. You can print it or email it to your
              doctor.
            </p>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive font-medium">
                {error}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
