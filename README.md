# Inquire - Cognitive Assessment Tool

**1st Place Winner, HackFax x PatriotHacks Hackathon**

Inquire is a browser-based neurological screening platform that uses AI and computer vision to perform three clinically-validated cognitive and motor assessments using only a webcam.

## Overview

Inquire democratizes access to neurological screening by bringing clinical-grade assessments directly to your browser. All processing happens locally on your device, ensuring privacy while providing immediate feedback on cognitive and motor function.

## Features

### Three Clinical Assessments

**🗣️ Speech Test (Verbal Fluency)**
- Measures word generation ability over 60 seconds
- Based on the FAS/COWAT clinical paradigm
- Detects reduced verbal fluency and increased repetitions
- Uses Web Speech API for real-time transcription

**✋ Hand Movement Test (Motor Sequencing)**
- Tracks the Fist-Edge-Palm sequence for 15 seconds
- Evaluates motor coordination and sequencing ability
- Identifies signs of apraxia or Parkinsonian impairment
- Uses MediaPipe HandLandmarker (21 hand landmarks)

**👀 Eye Tracking Test (Smooth Pursuit)**
- Monitors eye movements following a moving target for 15 seconds
- Assesses oculomotor control and neurological function
- Implements precision iris tracking with 9-point calibration
- Uses MediaPipe FaceLandmarker (5 iris landmarks per eye)

### Additional Features

- **User Authentication** - Secure login with JWT tokens and bcrypt password hashing
- **Assessment History** - Track results over time to identify trends
- **PDF Reports** - Generate detailed reports with scores and visualizations
- **Admin Dashboard** - View all user assessments and statistics
- **Privacy-First** - All AI processing happens locally in the browser
- **Responsive Design** - Works on desktop and tablet devices

## Tech Stack

**Frontend:**
- React 19
- Next.js 16
- TypeScript
- Tailwind CSS
- shadcn/ui (Radix UI)

**Backend:**
- Next.js API Routes
- Node.js
- SQLite + Drizzle ORM

**AI/ML:**
- Google MediaPipe (Hand & Face Tracking)
- Web Speech API (Speech Recognition)

**Other:**
- jsPDF (Report Generation)
- Recharts (Data Visualization)
- Jose (JWT Authentication)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Modern browser (Chrome, Edge, or Firefox recommended)
- Webcam and microphone access

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/inquire.git
cd inquire
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your JWT secret:
```
JWT_SECRET=your-secret-key-here
```

4. Initialize the database
```bash
npm run db:push
```

5. Run the development server
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Register/Login** - Create an account or log in
2. **Grant Permissions** - Allow camera and microphone access
3. **Complete Assessments** - Follow on-screen instructions for each test
4. **View Results** - See your scores and detailed breakdown
5. **Track Progress** - Access history to monitor changes over time
6. **Generate Reports** - Download PDF reports to share with healthcare providers

## Project Structure

```
inquire/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── admin/             # Admin dashboard
│   ├── login/             # Login page
│   └── register/          # Registration page
├── components/            # React components
│   ├── neuro-screen/     # Assessment components
│   └── ui/               # UI components (shadcn)
├── lib/                   # Utilities and configurations
│   ├── db/               # Database schema and client
│   └── auth.ts           # Authentication logic
├── data/                  # SQLite database files
└── public/               # Static assets
```

## Clinical Background

The assessments are based on established neurological screening tests:

- **Speech Test**: FAS/COWAT (Controlled Oral Word Association Test) - benchmark ~14 words/letter
- **Hand Test**: Luria Fist-Edge-Palm sequencing - evaluates motor planning
- **Eye Test**: Smooth pursuit tracking - measures oculomotor control

## Limitations

- Not a diagnostic tool - results should be discussed with healthcare professionals
- Requires good lighting and stable camera positioning
- Performance varies with webcam quality and browser support
- Not validated in formal clinical trials

## Browser Compatibility

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ⚠️ Safari (Limited Web Speech API support)

## Contributing

This project was created for HackFax x PatriotHacks. Contributions, issues, and feature requests are welcome!

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Google MediaPipe for computer vision models
- Clinical research on FAS/COWAT, Luria sequencing, and smooth pursuit testing
- HackFax x PatriotHacks for the opportunity

## Contact

For questions or feedback, please open an issue on GitHub.

---

**⚠️ Medical Disclaimer**: Inquire is a screening tool for educational and informational purposes only. It is not intended to diagnose, treat, cure, or prevent any disease. Always consult with a qualified healthcare professional for medical advice.
