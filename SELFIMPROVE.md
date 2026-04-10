## SelfImprove Integration
This project uses SelfImprove for AI product management.
Dashboard: https://selfimprove-iota.vercel.app/dashboard/personalaitutor/roadmap
Widget: https://selfimprove-iota.vercel.app/widget.js (project: 4d3357e8-c1a1-4758-8954-d7e74701e378)
Signals API: https://selfimprove-iota.vercel.app/api/signals

### For coding agents
- A feedback widget collects user signals from the live site
- Signals feed an AI-generated product roadmap with PRDs
- When implementing features, check the roadmap for acceptance criteria
- POST feedback to /api/signals with {project_id: "4d3357e8-c1a1-4758-8954-d7e74701e378", type: "feedback", content: "..."}
