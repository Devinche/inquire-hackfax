export interface AssessmentData {
  email?: string
  speechData: any
  handData: any
  eyeData: any
  timestamp: string
}

export async function saveAssessment(data: AssessmentData) {
  const response = await fetch("/api/assessments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error("Failed to save assessment")
  }

  return response.json()
}

export async function getAssessments(email?: string) {
  const url = email
    ? `/api/assessments?email=${encodeURIComponent(email)}`
    : "/api/assessments"

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error("Failed to retrieve assessments")
  }

  return response.json()
}
