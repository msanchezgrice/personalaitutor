"use client";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { CAREER_PATHS } from "@aitutor/shared";
import styles from "./chat-onboarding-prototype.module.css";
import {
  buildAssessmentAnswers,
  buildHandleBase,
  buildLearningPlan,
  COMPANY_SIZE_LABELS,
  createEmptyNotes,
  EXPERIENCE_LABELS,
  getCoveragePercent,
  getMissingRequiredFields,
  GOAL_LABELS,
  mergeOnboardingNotes,
  REALTIME_TOOL_NAME,
  REQUIRED_NOTE_LABELS,
  SITUATION_LABELS,
  type LearningPlanPreview,
  type OnboardingNotes,
  type RealtimeOnboardingUpdate,
  type TranscriptEntry,
  type TranscriptSpeaker,
} from "./prototype-data";

type AvatarVendor = "native" | "synthesia" | "heygen";
type ConnectionState = "idle" | "connecting" | "live" | "ended" | "error";

type RealtimeBootstrapResponse = {
  ok: boolean;
  clientSecret?: string;
  model?: string;
  expiresAt?: string | null;
  error?: string;
};

type OnboardingStartPayload = {
  ok: boolean;
  session?: { id: string; userId: string };
  sessionToken?: string;
  error?: { message?: string };
};

type OnboardingCompletePayload = {
  ok: boolean;
  assessment?: { id: string; score: number; recommendedCareerPathIds: string[] };
  session?: { id: string; userId: string };
  error?: { message?: string };
};

const synthesiaEmbedUrl =
  process.env.NEXT_PUBLIC_CHAT_ONBOARDING_SYNTHESIA_URL?.trim() ??
  "https://share.synthesia.io/17371f4f-02dc-489c-9b9a-ffc0aae4962b";
const heygenEmbedUrl = process.env.NEXT_PUBLIC_CHAT_ONBOARDING_HEYGEN_URL?.trim() ?? "";

const vendorCards: Array<{
  id: AvatarVendor;
  label: string;
  description: string;
  url: string;
}> = [
  {
    id: "native",
    label: "Voice Orb",
    description: "Uses OpenAI Realtime voice immediately and keeps the visual layer inside the app.",
    url: "",
  },
  {
    id: "synthesia",
    label: "Synthesia",
    description: "Drop in a hosted Synthesia scene or avatar room URL when you want a vendor-backed face.",
    url: synthesiaEmbedUrl,
  },
  {
    id: "heygen",
    label: "HeyGen",
    description: "Swap in a HeyGen streaming room URL if you want a different avatar layer.",
    url: heygenEmbedUrl,
  },
];

function makeTranscriptEntry(speaker: TranscriptSpeaker, text: string): TranscriptEntry {
  return {
    id: `${speaker}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    speaker,
    text,
    timestamp: Date.now(),
  };
}

function isHttpUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeToolUpdate(raw: string): RealtimeOnboardingUpdate {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
      fullName: typeof parsed.fullName === "string" ? parsed.fullName : undefined,
      jobTitle: typeof parsed.jobTitle === "string" ? parsed.jobTitle : undefined,
      careerPathId:
        typeof parsed.careerPathId === "string" && CAREER_PATHS.some((path) => path.id === parsed.careerPathId)
          ? (parsed.careerPathId as OnboardingNotes["careerPathId"])
          : undefined,
      careerCategoryLabel:
        typeof parsed.careerCategoryLabel === "string" ? parsed.careerCategoryLabel : undefined,
      yearsExperience:
        parsed.yearsExperience === "0-1" ||
        parsed.yearsExperience === "1-3" ||
        parsed.yearsExperience === "3-5" ||
        parsed.yearsExperience === "5-10" ||
        parsed.yearsExperience === "10+"
          ? parsed.yearsExperience
          : undefined,
      companySize:
        parsed.companySize === "startup" ||
        parsed.companySize === "small" ||
        parsed.companySize === "medium" ||
        parsed.companySize === "large"
          ? parsed.companySize
          : undefined,
      situation:
        parsed.situation === "employed" ||
        parsed.situation === "unemployed" ||
        parsed.situation === "student" ||
        parsed.situation === "founder" ||
        parsed.situation === "freelancer" ||
        parsed.situation === "career_switcher"
          ? parsed.situation
          : undefined,
      dailyWorkSummary:
        typeof parsed.dailyWorkSummary === "string" ? parsed.dailyWorkSummary : undefined,
      keySkills: Array.isArray(parsed.keySkills)
        ? parsed.keySkills.filter((entry): entry is string => typeof entry === "string")
        : undefined,
      selectedGoals: Array.isArray(parsed.selectedGoals)
        ? parsed.selectedGoals.filter(
            (entry): entry is OnboardingNotes["selectedGoals"][number] =>
              entry === "build_business" ||
              entry === "upskill_current_job" ||
              entry === "showcase_for_job" ||
              entry === "learn_foundations" ||
              entry === "ship_ai_projects",
          )
        : undefined,
      aiComfort:
        typeof parsed.aiComfort === "number" ? parsed.aiComfort : undefined,
      linkedinUrl: typeof parsed.linkedinUrl === "string" ? parsed.linkedinUrl : undefined,
      resumeFilename:
        typeof parsed.resumeFilename === "string" ? parsed.resumeFilename : undefined,
      needsFollowup: Array.isArray(parsed.needsFollowup)
        ? parsed.needsFollowup.filter(
            (entry): entry is NonNullable<RealtimeOnboardingUpdate["needsFollowup"]>[number] =>
              entry === "fullName" ||
              entry === "jobTitle" ||
              entry === "careerPathId" ||
              entry === "yearsExperience" ||
              entry === "situation" ||
              entry === "dailyWorkSummary" ||
              entry === "keySkills" ||
              entry === "selectedGoals" ||
              entry === "aiComfort",
          )
        : undefined,
    };
  } catch {
    return {};
  }
}

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as T & {
    ok?: boolean;
    error?: { message?: string } | string;
  };

  if (!response.ok || !payload || (typeof payload === "object" && "ok" in payload && !payload.ok)) {
    if (typeof payload.error === "string") {
      throw new Error(payload.error);
    }
    throw new Error(payload.error?.message ?? "Request failed");
  }

  return payload;
}

export function ChatOnboardingPrototype() {
  const [vendor, setVendor] = useState<AvatarVendor>("native");
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [statusMessage, setStatusMessage] = useState("Ready to start a live onboarding intake.");
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<OnboardingNotes>(() => createEmptyNotes());
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [draftReply, setDraftReply] = useState("");
  const [waitingForAssistant, setWaitingForAssistant] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [plan, setPlan] = useState<LearningPlanPreview | null>(null);
  const [planSessionId, setPlanSessionId] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const notesRef = useRef(notes);

  const selectedVendor = vendorCards.find((card) => card.id === vendor) ?? vendorCards[0];
  const currentCareerPath = useMemo(
    () => CAREER_PATHS.find((path) => path.id === notes.careerPathId) ?? null,
    [notes.careerPathId],
  );
  const missingFields = useMemo(() => getMissingRequiredFields(notes), [notes]);
  const coverage = useMemo(() => getCoveragePercent(notes), [notes]);
  const normalizedScore = useMemo(() => {
    if (!plan) return null;
    return plan.assessmentScore <= 1 ? Math.round(plan.assessmentScore * 100) : Math.round(plan.assessmentScore);
  }, [plan]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const appendTranscript = useEffectEvent((speaker: TranscriptSpeaker, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    startTransition(() => {
      setTranscript((current) => [...current.slice(-39), makeTranscriptEntry(speaker, trimmed)]);
    });
  });

  const closeConnection = useEffectEvent((nextState: ConnectionState = "ended") => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    setWaitingForAssistant(false);
    setConnectionState(nextState);
  });

  const sendRealtimeEvent = useEffectEvent((payload: Record<string, unknown>) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") return;
    channel.send(JSON.stringify(payload));
  });

  const handleRealtimeEvent = useEffectEvent((event: Record<string, unknown>) => {
    const type = typeof event.type === "string" ? event.type : "";

    if (type === "conversation.item.input_audio_transcription.completed") {
      const transcriptText = typeof event.transcript === "string" ? event.transcript : "";
      appendTranscript("user", transcriptText);
      setWaitingForAssistant(true);
      return;
    }

    if (type === "response.audio_transcript.done") {
      const transcriptText = typeof event.transcript === "string" ? event.transcript : "";
      appendTranscript("assistant", transcriptText);
      setWaitingForAssistant(false);
      return;
    }

    if (type === "response.function_call_arguments.done") {
      const name = typeof event.name === "string" ? event.name : "";
      if (name !== REALTIME_TOOL_NAME) return;

      const nextNotes = mergeOnboardingNotes(
        notesRef.current,
        normalizeToolUpdate(typeof event.arguments === "string" ? event.arguments : "{}"),
      );
      notesRef.current = nextNotes;
      setNotes(nextNotes);
      setStatusMessage(nextNotes.summary || "Notes updated live from the conversation.");

      const callId = typeof event.call_id === "string" ? event.call_id : "";
      if (callId) {
        sendRealtimeEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({
              ok: true,
              missingFields: getMissingRequiredFields(nextNotes),
              coverage: getCoveragePercent(nextNotes),
            }),
          },
        });
        sendRealtimeEvent({ type: "response.create" });
      }
      return;
    }

    if (type === "error") {
      const message =
        typeof event.error === "object" &&
        event.error &&
        "message" in event.error &&
        typeof event.error.message === "string"
          ? event.error.message
          : "Realtime session failed.";
      setError(message);
      setStatusMessage(message);
      setConnectionState("error");
      return;
    }

    if (type === "response.done") {
      setWaitingForAssistant(false);
    }
  });

  useEffect(() => {
    return () => {
      closeConnection("ended");
    };
  }, [closeConnection]);

  async function startOnboardingCall() {
    closeConnection("idle");
    setError(null);
    setPlan(null);
    setPlanSessionId(null);
    const emptyNotes = createEmptyNotes();
    setNotes(emptyNotes);
    notesRef.current = emptyNotes;
    setTranscript([]);
    setStatusMessage("Connecting microphone, voice session, and note capture.");
    setConnectionState("connecting");

    try {
      const bootstrap = await postJson<RealtimeBootstrapResponse>("/chat-onboarding-prototype/realtime", {});
      if (!bootstrap.clientSecret || !bootstrap.model) {
        throw new Error("Realtime session did not return a client secret.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const peerConnection = new RTCPeerConnection();
      localStreamRef.current = stream;
      peerConnectionRef.current = peerConnection;

      for (const track of stream.getTracks()) {
        peerConnection.addTrack(track, stream);
      }

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream || !audioRef.current) return;
        audioRef.current.srcObject = remoteStream;
        void audioRef.current.play().catch(() => {
          // Some browsers delay autoplay until the first user gesture, but the click that started
          // the call is usually enough. If play fails here we keep the stream attached.
        });
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === "connected") {
          setConnectionState("live");
          setStatusMessage("Live. The onboarding host is ready and the notes panel is listening.");
        }

        if (peerConnection.connectionState === "failed") {
          setConnectionState("error");
          setError("The live audio session dropped. Restart the onboarding call.");
        }
      };

      const dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;

      dataChannel.addEventListener("open", () => {
        appendTranscript("system", "Voice session connected. The onboarding host is joining.");
        sendRealtimeEvent({
          type: "response.create",
          response: {
            instructions:
              "Introduce yourself in one sentence, explain that you will build a learning plan from this conversation, and ask for the person's name first.",
          },
        });
      });

      dataChannel.addEventListener("message", (messageEvent) => {
        try {
          handleRealtimeEvent(JSON.parse(String(messageEvent.data)) as Record<string, unknown>);
        } catch {
          // Ignore non-JSON events.
        }
      });

      dataChannel.addEventListener("close", () => {
        if (connectionState !== "ended") {
          setConnectionState("ended");
          setStatusMessage("Call ended. Notes stay on screen so you can still generate a plan.");
        }
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const realtimeResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bootstrap.clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp ?? "",
      });

      if (!realtimeResponse.ok) {
        const failureText = await realtimeResponse.text().catch(() => "");
        throw new Error(failureText || "Unable to establish the realtime audio session.");
      }

      const answerSdp = await realtimeResponse.text();
      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (startError) {
      closeConnection("error");
      const message = startError instanceof Error ? startError.message : "Unable to start the onboarding call.";
      setError(message);
      setStatusMessage(message);
    }
  }

  function endOnboardingCall() {
    closeConnection("ended");
    appendTranscript("system", "Call ended. The live notes remain available.");
    setStatusMessage("Call ended. You can restart the interview or generate a learning plan from the captured notes.");
  }

  function resetPrototype() {
    closeConnection("idle");
    setError(null);
    setPlan(null);
    setPlanSessionId(null);
    setTranscript([]);
    const empty = createEmptyNotes();
    setNotes(empty);
    notesRef.current = empty;
    setDraftReply("");
    setStatusMessage("Ready to start a new onboarding session.");
  }

  function sendTypedReply() {
    const message = draftReply.trim();
    if (!message) return;
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      setError("Start the live onboarding call before sending typed replies.");
      return;
    }

    setDraftReply("");
    appendTranscript("user", message);
    setWaitingForAssistant(true);
    sendRealtimeEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    });
    sendRealtimeEvent({
      type: "response.create",
      response: {},
    });
  }

  async function generateLearningPlan() {
    const currentNotes = notesRef.current;
    const missing = getMissingRequiredFields(currentNotes);
    if (missing.length > 0) {
      setError(`The intake is still missing: ${missing.map((field) => REQUIRED_NOTE_LABELS[field]).join(", ")}.`);
      return;
    }

    setPlanBusy(true);
    setError(null);
    setStatusMessage("Generating the structured learning plan from the captured intake.");

    try {
      const start = await postJson<OnboardingStartPayload>("/api/onboarding/start", {
        name: currentNotes.fullName,
        handleBase: buildHandleBase(currentNotes.fullName),
        careerPathId: currentNotes.careerPathId,
      });

      if (!start.session?.id || !start.sessionToken) {
        throw new Error("Onboarding session bootstrap did not return the fields required for plan generation.");
      }

      const completed = await postJson<OnboardingCompletePayload>("/api/onboarding/complete", {
        sessionId: start.session.id,
        sessionToken: start.sessionToken,
        careerPathId: currentNotes.careerPathId,
        careerCategoryLabel: currentNotes.careerCategoryLabel || currentCareerPath?.name || currentNotes.jobTitle,
        jobTitle: currentNotes.jobTitle,
        yearsExperience: currentNotes.yearsExperience,
        companySize: currentNotes.companySize || null,
        dailyWorkSummary: currentNotes.dailyWorkSummary,
        keySkills: currentNotes.keySkills.join(", "),
        aiComfort: currentNotes.aiComfort ?? 3,
        linkedinUrl: currentNotes.linkedinUrl || null,
        resumeFilename: currentNotes.resumeFilename || null,
        situation: currentNotes.situation,
        goals: currentNotes.selectedGoals,
        answers: buildAssessmentAnswers(currentNotes),
      });

      const recommendedCareerPathIds =
        completed.assessment?.recommendedCareerPathIds?.length
          ? completed.assessment.recommendedCareerPathIds
          : [currentNotes.careerPathId];

      setPlan(
        buildLearningPlan({
          notes: currentNotes,
          recommendedCareerPathIds,
          assessmentScore: completed.assessment?.score ?? 0,
        }),
      );
      setPlanSessionId(start.session.id);
      setStatusMessage("Learning plan ready. The right rail now mirrors the structured intake and recommended track.");
    } catch (planError) {
      const message = planError instanceof Error ? planError.message : "Unable to build the learning plan.";
      setError(message);
      setStatusMessage(message);
    } finally {
      setPlanBusy(false);
    }
  }

  return (
    <main className={styles.shell}>
      <audio ref={audioRef} autoPlay playsInline hidden />

      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>Chat Onboarding Prototype</div>
          <h1 className={styles.title}>A voice-first onboarding host with a live avatar surface and structured notes.</h1>
          <p className={styles.subtitle}>
            Start a realtime conversation, let the host ask the onboarding questions one at a time, and watch the intake
            turn into plan-ready notes beside the call.
          </p>
        </div>

        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={startOnboardingCall}
            disabled={connectionState === "connecting"}
          >
            {connectionState === "connecting" ? "Connecting..." : "Start onboarding"}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={endOnboardingCall}
            disabled={connectionState !== "live" && connectionState !== "connecting"}
          >
            End call
          </button>
          <button type="button" className={styles.ghostButton} onClick={resetPrototype}>
            Reset
          </button>
        </div>
      </section>

      <section className={styles.statusStrip}>
        <div className={styles.statusCard}>
          <span className={styles.statusLabel}>Connection</span>
          <strong>{connectionState === "live" ? "Live" : connectionState === "connecting" ? "Connecting" : connectionState === "error" ? "Needs attention" : "Idle"}</strong>
        </div>
        <div className={styles.statusCard}>
          <span className={styles.statusLabel}>Notes coverage</span>
          <strong>{coverage}%</strong>
        </div>
        <div className={styles.statusCard}>
          <span className={styles.statusLabel}>Plan readiness</span>
          <strong>{missingFields.length === 0 ? "Ready" : `${missingFields.length} fields left`}</strong>
        </div>
        <div className={styles.statusMessage}>{statusMessage}</div>
      </section>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <div className={styles.layout}>
        <section className={styles.stageColumn}>
          <div className={styles.vendorRow}>
            {vendorCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={card.id === vendor ? styles.vendorChipActive : styles.vendorChip}
                onClick={() => setVendor(card.id)}
              >
                <span>{card.label}</span>
                <small>{card.url ? "Configured" : card.id === "native" ? "Built in" : "Needs URL"}</small>
              </button>
            ))}
          </div>

          <article className={styles.avatarStage}>
            <div className={styles.avatarStageHeader}>
              <div>
                <div className={styles.panelEyebrow}>Avatar surface</div>
                <h2>{selectedVendor.label}</h2>
              </div>
              <div className={waitingForAssistant ? styles.liveBadgeHot : styles.liveBadge}>
                {waitingForAssistant ? "Responding" : connectionState === "live" ? "Listening" : "Waiting"}
              </div>
            </div>

            {selectedVendor.id !== "native" && isHttpUrl(selectedVendor.url) ? (
              <iframe
                className={styles.vendorFrame}
                src={selectedVendor.url}
                title={`${selectedVendor.label} onboarding avatar`}
                allow="camera; microphone; autoplay; encrypted-media"
              />
            ) : (
              <div className={styles.avatarCanvas}>
                <div className={waitingForAssistant ? styles.orbitRingHot : styles.orbitRing}></div>
                <div className={styles.avatarBody}>
                  <div className={styles.avatarFace}>
                    <span className={styles.avatarEye}></span>
                    <span className={styles.avatarEye}></span>
                  </div>
                  <div className={waitingForAssistant ? styles.avatarMouthHot : styles.avatarMouth}></div>
                </div>
                <div className={styles.avatarCopy}>
                  <strong>{selectedVendor.label}</strong>
                  <p>{selectedVendor.description}</p>
                  {selectedVendor.id !== "native" && !selectedVendor.url ? (
                    <span className={styles.integrationHint}>
                      Add {selectedVendor.id === "synthesia" ? "`NEXT_PUBLIC_CHAT_ONBOARDING_SYNTHESIA_URL`" : "`NEXT_PUBLIC_CHAT_ONBOARDING_HEYGEN_URL`"} to swap the native visual with a hosted vendor avatar.
                    </span>
                  ) : null}
                </div>
              </div>
            )}

            <div className={styles.surfaceFooter}>
              <div>
                <span className={styles.footerLabel}>Audio path</span>
                <strong>OpenAI Realtime WebRTC</strong>
              </div>
              <div>
                <span className={styles.footerLabel}>Notes path</span>
                <strong>Tool-call extraction + live field sync</strong>
              </div>
            </div>
          </article>

          <article className={styles.transcriptPanel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelEyebrow}>Conversation</div>
                <h2>Live transcript</h2>
              </div>
              <span className={styles.transcriptMeta}>{transcript.length} turns</span>
            </div>

            <div className={styles.transcriptFeed}>
              {transcript.length ? (
                transcript.map((entry) => (
                  <div key={entry.id} className={styles[`transcript${entry.speaker[0].toUpperCase()}${entry.speaker.slice(1)}`]}>
                    <span className={styles.transcriptSpeaker}>
                      {entry.speaker === "assistant" ? "Host" : entry.speaker === "user" ? "You" : "System"}
                    </span>
                    <p>{entry.text}</p>
                  </div>
                ))
              ) : (
                <div className={styles.transcriptEmpty}>
                  The transcript will appear here as soon as the host starts asking questions.
                </div>
              )}
            </div>

            <form
              className={styles.replyComposer}
              onSubmit={(event) => {
                event.preventDefault();
                sendTypedReply();
              }}
            >
              <input
                className={styles.replyInput}
                value={draftReply}
                onChange={(event) => setDraftReply(event.target.value)}
                placeholder="Typed fallback if you want to answer without speaking"
              />
              <button type="submit" className={styles.secondaryButton}>
                Send
              </button>
            </form>
          </article>
        </section>

        <aside className={styles.notesColumn}>
          <article className={styles.notesPanel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelEyebrow}>Structured intake</div>
                <h2>Live notes</h2>
              </div>
              <div className={styles.coveragePill}>{coverage}% captured</div>
            </div>

            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Working summary</span>
              <p>{notes.summary || "The host will keep this summary updated as answers come in."}</p>
            </div>

            <div className={styles.noteGrid}>
              <div className={styles.noteTile}>
                <span>Name</span>
                <strong>{notes.fullName || "Waiting"}</strong>
              </div>
              <div className={styles.noteTile}>
                <span>Role</span>
                <strong>{notes.jobTitle || "Waiting"}</strong>
              </div>
              <div className={styles.noteTile}>
                <span>Learning track</span>
                <strong>{currentCareerPath?.name || notes.careerCategoryLabel || "Waiting"}</strong>
              </div>
              <div className={styles.noteTile}>
                <span>Experience</span>
                <strong>{notes.yearsExperience ? EXPERIENCE_LABELS[notes.yearsExperience] : "Waiting"}</strong>
              </div>
              <div className={styles.noteTile}>
                <span>Situation</span>
                <strong>{notes.situation ? SITUATION_LABELS[notes.situation] : "Waiting"}</strong>
              </div>
              <div className={styles.noteTile}>
                <span>Company size</span>
                <strong>{notes.companySize ? COMPANY_SIZE_LABELS[notes.companySize] : "Optional"}</strong>
              </div>
            </div>

            <div className={styles.noteBlock}>
              <span>Day-to-day work</span>
              <p>{notes.dailyWorkSummary || "The host will turn the spoken work summary into notes here."}</p>
            </div>

            <div className={styles.noteBlock}>
              <span>Tools and skills</span>
              <div className={styles.chipRow}>
                {notes.keySkills.length ? notes.keySkills.map((skill) => <span key={skill} className={styles.infoChip}>{skill}</span>) : <span className={styles.emptyInline}>No tools captured yet.</span>}
              </div>
            </div>

            <div className={styles.noteBlock}>
              <span>Goals</span>
              <div className={styles.chipRow}>
                {notes.selectedGoals.length ? notes.selectedGoals.map((goal) => <span key={goal} className={styles.goalChip}>{GOAL_LABELS[goal]}</span>) : <span className={styles.emptyInline}>The host still needs to capture the learning goals.</span>}
              </div>
            </div>

            <div className={styles.noteBlock}>
              <span>AI comfort</span>
              <p>{typeof notes.aiComfort === "number" ? `${notes.aiComfort}/5` : "Waiting"}</p>
            </div>

            <div className={styles.noteGrid}>
              <div className={styles.noteTile}>
                <span>LinkedIn</span>
                <strong>{notes.linkedinUrl || "Optional"}</strong>
              </div>
              <div className={styles.noteTile}>
                <span>Resume note</span>
                <strong>{notes.resumeFilename || "Optional"}</strong>
              </div>
            </div>

            <div className={styles.followupCard}>
              <span>Still needed</span>
              <div className={styles.chipRow}>
                {missingFields.length ? (
                  missingFields.map((field) => (
                    <span key={field} className={styles.missingChip}>
                      {REQUIRED_NOTE_LABELS[field]}
                    </span>
                  ))
                ) : (
                  <span className={styles.readyChip}>The intake is complete enough to generate a plan.</span>
                )}
              </div>
            </div>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={generateLearningPlan}
              disabled={planBusy || missingFields.length > 0}
            >
              {planBusy ? "Generating plan..." : "Generate learning plan"}
            </button>
          </article>
        </aside>
      </div>

      <section className={styles.planSection}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelEyebrow}>Plan output</div>
            <h2>Learning plan preview</h2>
          </div>
          {plan && normalizedScore !== null ? <div className={styles.scoreBadge}>Assessment {normalizedScore}</div> : null}
        </div>

        {plan ? (
          <div className={styles.planGrid}>
            <article className={styles.planHeroCard}>
              <span className={styles.planLabel}>Primary track</span>
              <h3>{plan.primaryPath.name}</h3>
              <p>{plan.primaryPath.coreSkillDomain}</p>
              <div className={styles.chipRow}>
                {plan.supportingPaths.map((path) => (
                  <span key={path.id} className={styles.infoChip}>
                    Also watch: {path.name}
                  </span>
                ))}
              </div>
              {planSessionId ? <small className={styles.sessionHint}>Onboarding session: {planSessionId}</small> : null}
            </article>

            <article className={styles.planCard}>
              <span className={styles.planLabel}>Focus modules</span>
              <ul className={styles.planList}>
                {plan.focusModules.map((module) => (
                  <li key={module}>{module}</li>
                ))}
              </ul>
            </article>

            <article className={styles.planCard}>
              <span className={styles.planLabel}>Tool stack</span>
              <div className={styles.chipRow}>
                {plan.toolStack.map((tool) => (
                  <span key={tool} className={styles.infoChip}>
                    {tool}
                  </span>
                ))}
              </div>
            </article>

            <article className={styles.planCardWide}>
              <span className={styles.planLabel}>First project</span>
              <p>{plan.projectIdea}</p>
            </article>

            <article className={styles.planCardWide}>
              <span className={styles.planLabel}>30-60-90 plan</span>
              <div className={styles.milestoneGrid}>
                {plan.milestones.map((milestone) => (
                  <div key={milestone.window} className={styles.milestoneCard}>
                    <strong>{milestone.window}</strong>
                    <h3>{milestone.title}</h3>
                    <p>{milestone.detail}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.planCard}>
              <span className={styles.planLabel}>Proof artifacts</span>
              <ul className={styles.planList}>
                {plan.proofArtifacts.map((artifact) => (
                  <li key={artifact}>{artifact}</li>
                ))}
              </ul>
            </article>

            <article className={styles.planCard}>
              <span className={styles.planLabel}>Guides to open next</span>
              <div className={styles.linkList}>
                {plan.guideLinks.map((guide) => (
                  <a key={guide.href} href={guide.href} className={styles.inlineLink}>
                    {guide.label}
                  </a>
                ))}
              </div>
            </article>
          </div>
        ) : (
          <div className={styles.planEmpty}>
            Finish the intake, then generate the learning plan to see modules, project direction, and proof milestones.
          </div>
        )}
      </section>
    </main>
  );
}
