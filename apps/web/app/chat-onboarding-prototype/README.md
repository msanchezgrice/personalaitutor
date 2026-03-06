# Chat Onboarding Prototype

Route: `/chat-onboarding-prototype`

What it does:
- Starts a browser-side OpenAI Realtime WebRTC conversation.
- Uses a structured tool call to keep onboarding notes updated live.
- Generates a learning-plan preview by calling the existing onboarding APIs once the intake is complete.

Required env:
- `OPENAI_API_KEY`

Optional env for avatar vendor swap-ins:
- `OPENAI_REALTIME_MODEL`
- `NEXT_PUBLIC_CHAT_ONBOARDING_SYNTHESIA_URL`
- `NEXT_PUBLIC_CHAT_ONBOARDING_HEYGEN_URL`

Current prototype default:
- Synthesia fallback share URL: `https://share.synthesia.io/17371f4f-02dc-489c-9b9a-ffc0aae4962b`
