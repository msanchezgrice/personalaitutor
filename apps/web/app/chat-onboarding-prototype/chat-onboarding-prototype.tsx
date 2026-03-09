"use client";
import {
  startTransition,
  useCallback,
  useEffect,
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
  REQUIRED_NOTE_FIELDS,
  REQUIRED_NOTE_LABELS,
  REQUIRED_NOTE_PROMPTS,
  SITUATION_LABELS,
  type LearningPlanPreview,
  type OnboardingNotes,
  type RealtimeOnboardingUpdate,
  type RequiredNoteField,
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

type CompletedPrompt = {
  id: string;
  field: RequiredNoteField;
};

type SyncSource = "voice" | "typed" | "manual";

type StructuredUpdate = {
  fields: Array<keyof OnboardingNotes>;
  source: SyncSource;
  timestamp: number;
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

const TRACKED_NOTE_KEYS: Array<keyof OnboardingNotes> = [
  "summary",
  "fullName",
  "jobTitle",
  "careerPathId",
  "careerCategoryLabel",
  "yearsExperience",
  "companySize",
  "situation",
  "dailyWorkSummary",
  "keySkills",
  "selectedGoals",
  "aiComfort",
  "linkedinUrl",
  "resumeFilename",
];

const NOTE_FIELD_LABELS: Record<keyof OnboardingNotes, string> = {
  summary: "Working summary",
  fullName: "Name",
  jobTitle: "Role",
  careerPathId: "Learning track",
  careerCategoryLabel: "Track label",
  yearsExperience: "Experience",
  companySize: "Company size",
  situation: "Situation",
  dailyWorkSummary: "Day-to-day work",
  keySkills: "Tools and skills",
  selectedGoals: "Goals",
  aiComfort: "AI comfort",
  linkedinUrl: "LinkedIn",
  resumeFilename: "Resume note",
};

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
              entry === "find_new_role" ||
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

function parseDelimitedList(value: string, maxItems = 12) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ).slice(0, maxItems);
}

function getChangedNoteFields(previous: OnboardingNotes, next: OnboardingNotes): Array<keyof OnboardingNotes> {
  return TRACKED_NOTE_KEYS.filter((field) => {
    const previousValue = previous[field];
    const nextValue = next[field];

    if (Array.isArray(previousValue) && Array.isArray(nextValue)) {
      return previousValue.join("||") !== nextValue.join("||");
    }

    return previousValue !== nextValue;
  });
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
  const [rotatingMissingIndex, setRotatingMissingIndex] = useState(0);
  const [completedPrompts, setCompletedPrompts] = useState<CompletedPrompt[]>([]);
  const [lastStructuredUpdate, setLastStructuredUpdate] = useState<StructuredUpdate | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const notesRef = useRef(notes);
  const connectionTokenRef = useRef(0);
  const previousMissingFieldsRef = useRef<RequiredNoteField[]>([]);
  const completedPromptTimeoutsRef = useRef<number[]>([]);
  const pendingInputSourceRef = useRef<SyncSource | null>(null);

  const selectedVendor = vendorCards.find((card) => card.id === vendor) ?? vendorCards[0];
  const currentCareerPath = useMemo(
    () => CAREER_PATHS.find((path) => path.id === notes.careerPathId) ?? null,
    [notes.careerPathId],
  );
  const missingFields = useMemo(() => getMissingRequiredFields(notes), [notes]);
  const coverage = useMemo(() => getCoveragePercent(notes), [notes]);
  const activeMissingField =
    missingFields.length > 0 ? missingFields[rotatingMissingIndex % missingFields.length] : null;
  const normalizedScore = useMemo(() => {
    if (!plan) return null;
    return plan.assessmentScore <= 1 ? Math.round(plan.assessmentScore * 100) : Math.round(plan.assessmentScore);
  }, [plan]);
  const notesPayload = useMemo(() => JSON.stringify(notes, null, 2), [notes]);
  const requiredPromptStates = useMemo(
    () =>
      REQUIRED_NOTE_FIELDS.map((field) => ({
        field,
        isActive: field === activeMissingField,
        isCaptured: !missingFields.includes(field),
      })),
    [activeMissingField, missingFields],
  );
  const capturedRequiredCount = useMemo(
    () => requiredPromptStates.filter((entry) => entry.isCaptured).length,
    [requiredPromptStates],
  );
  const latestRequiredFields = useMemo(
    () =>
      (lastStructuredUpdate?.fields ?? []).filter(
        (field): field is RequiredNoteField => REQUIRED_NOTE_FIELDS.includes(field as RequiredNoteField),
      ),
    [lastStructuredUpdate],
  );

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    const previousMissingFields = previousMissingFieldsRef.current;
    const newlyCompleted = previousMissingFields.filter((field) => !missingFields.includes(field));

    if (newlyCompleted.length) {
      const nextPrompts = newlyCompleted.map((field) => ({
        id: `${field}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        field,
      }));

      setCompletedPrompts((current) => [...nextPrompts, ...current].slice(0, 6));

      nextPrompts.forEach((prompt) => {
        const timeoutId = window.setTimeout(() => {
          setCompletedPrompts((current) => current.filter((entry) => entry.id !== prompt.id));
          completedPromptTimeoutsRef.current = completedPromptTimeoutsRef.current.filter(
            (activeTimeoutId) => activeTimeoutId !== timeoutId,
          );
        }, 2200);

        completedPromptTimeoutsRef.current.push(timeoutId);
      });
    }

    previousMissingFieldsRef.current = missingFields;
    setRotatingMissingIndex((current) => (missingFields.length ? current % missingFields.length : 0));
  }, [missingFields]);

  useEffect(() => {
    if (missingFields.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setRotatingMissingIndex((current) => (current + 1) % missingFields.length);
    }, 2600);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [missingFields]);

  useEffect(() => {
    return () => {
      completedPromptTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      completedPromptTimeoutsRef.current = [];
    };
  }, []);

  const appendTranscript = useCallback((speaker: TranscriptSpeaker, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    startTransition(() => {
      setTranscript((current) => [...current.slice(-39), makeTranscriptEntry(speaker, trimmed)]);
    });
  }, []);

  const closeConnection = useCallback((nextState: ConnectionState = "ended") => {
    connectionTokenRef.current += 1;
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
  }, []);

  const sendRealtimeEvent = useCallback((payload: Record<string, unknown>) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") return;
    channel.send(JSON.stringify(payload));
  }, []);

  const applyNotesUpdate = useCallback((nextNotes: OnboardingNotes, source: SyncSource) => {
    const previousNotes = notesRef.current;
    notesRef.current = nextNotes;
    setNotes(nextNotes);

    const changedFields = getChangedNoteFields(previousNotes, nextNotes);
    if (changedFields.length) {
      setLastStructuredUpdate({
        fields: changedFields,
        source,
        timestamp: Date.now(),
      });
    }
  }, []);

  const updateNoteField = useCallback(
    (field: keyof OnboardingNotes, value: OnboardingNotes[keyof OnboardingNotes]) => {
      applyNotesUpdate(
        {
          ...notesRef.current,
          [field]: value,
        } as OnboardingNotes,
        "manual",
      );
    },
    [applyNotesUpdate],
  );

  const toggleGoal = useCallback(
    (goal: OnboardingNotes["selectedGoals"][number]) => {
      const currentGoals = notesRef.current.selectedGoals;
      const nextGoals = currentGoals.includes(goal)
        ? currentGoals.filter((entry) => entry !== goal)
        : [...currentGoals, goal];

      updateNoteField("selectedGoals", nextGoals);
    },
    [updateNoteField],
  );

  const handleRealtimeEvent = useCallback((event: Record<string, unknown>) => {
    const type = typeof event.type === "string" ? event.type : "";

    if (type === "conversation.item.input_audio_transcription.completed") {
      const transcriptText = typeof event.transcript === "string" ? event.transcript : "";
      pendingInputSourceRef.current = "voice";
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
      applyNotesUpdate(nextNotes, pendingInputSourceRef.current ?? "voice");
      pendingInputSourceRef.current = null;
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
  }, [appendTranscript, applyNotesUpdate, sendRealtimeEvent]);

  useEffect(() => {
    return () => {
      closeConnection("ended");
    };
  }, [closeConnection]);

  async function startOnboardingCall() {
    closeConnection("idle");
    const connectionToken = connectionTokenRef.current;
    setError(null);
    setPlan(null);
    setPlanSessionId(null);
    setLastStructuredUpdate(null);
    completedPromptTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    completedPromptTimeoutsRef.current = [];
    previousMissingFieldsRef.current = [];
    pendingInputSourceRef.current = null;
    setCompletedPrompts([]);
    setRotatingMissingIndex(0);
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
      if (connectionToken !== connectionTokenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

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
        if (connectionToken !== connectionTokenRef.current) return;
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
        if (connectionToken !== connectionTokenRef.current) return;
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
        if (connectionToken !== connectionTokenRef.current) return;
        try {
          handleRealtimeEvent(JSON.parse(String(messageEvent.data)) as Record<string, unknown>);
        } catch {
          // Ignore non-JSON events.
        }
      });

      dataChannel.addEventListener("close", () => {
        if (connectionToken !== connectionTokenRef.current) return;
        if (connectionState !== "ended") {
          setConnectionState("ended");
          setStatusMessage("Call ended. Notes stay on screen so you can still generate a plan.");
        }
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      if (connectionToken !== connectionTokenRef.current || peerConnectionRef.current !== peerConnection) {
        return;
      }

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
      if (connectionToken !== connectionTokenRef.current || peerConnectionRef.current !== peerConnection) {
        return;
      }
      try {
        await peerConnection.setRemoteDescription({
          type: "answer",
          sdp: answerSdp,
        });
      } catch (remoteDescriptionError) {
        const remoteDescriptionMessage =
          remoteDescriptionError instanceof Error ? remoteDescriptionError.message : "";
        if (
          connectionToken !== connectionTokenRef.current ||
          peerConnectionRef.current !== peerConnection ||
          remoteDescriptionMessage.includes("signalingState is 'closed'")
        ) {
          return;
        }
        throw remoteDescriptionError;
      }
    } catch (startError) {
      if (connectionToken !== connectionTokenRef.current) {
        return;
      }
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
    completedPromptTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    completedPromptTimeoutsRef.current = [];
    previousMissingFieldsRef.current = [];
    setCompletedPrompts([]);
    setRotatingMissingIndex(0);
    setError(null);
    setPlan(null);
    setPlanSessionId(null);
    setLastStructuredUpdate(null);
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
    pendingInputSourceRef.current = "typed";
    sendRealtimeEvent({ type: "response.cancel" });
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

  const promptStagePanel = (
    <article className={styles.promptStagePanel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelEyebrow}>Prompt canvas</div>
          <h2>What the host is asking now</h2>
        </div>
        <div className={styles.notesBoardMeta}>
          <div className={styles.coveragePill}>
            {capturedRequiredCount}/{REQUIRED_NOTE_FIELDS.length} locked
          </div>
          <div className={waitingForAssistant ? styles.liveBadgeHot : styles.liveBadge}>
            {waitingForAssistant ? "Responding" : connectionState === "live" ? "Listening" : "Waiting"}
          </div>
        </div>
      </div>

      <div className={styles.vendorRow}>
        {vendorCards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={card.id === vendor ? styles.vendorChipActive : styles.vendorChip}
            onClick={() => setVendor(card.id)}
          >
            <span>{card.id === "native" ? "Prompt Stage" : card.label}</span>
            <small>{card.url ? "Configured" : card.id === "native" ? "Default" : "Needs URL"}</small>
          </button>
        ))}
      </div>

      <div className={styles.visualFrame}>
        <div className={styles.visualFrameBar}>
          <div className={styles.visualDots}>
            <span className={styles.visualDotAmber}></span>
            <span className={styles.visualDot}></span>
            <span className={styles.visualDotTeal}></span>
          </div>
          <span className={styles.visualFrameLabel}>
            {selectedVendor.id === "native" ? "Animated prompt surface" : `${selectedVendor.label} backdrop + prompt surface`}
          </span>
        </div>

        <div className={styles.visualFrameBody}>
          {selectedVendor.id !== "native" && isHttpUrl(selectedVendor.url) ? (
            <iframe
              className={styles.visualBackdropFrame}
              src={selectedVendor.url}
              title={`${selectedVendor.label} prompt backdrop`}
              allow="camera; microphone; autoplay; encrypted-media"
            />
          ) : (
            <div className={styles.visualBackdropGradient}></div>
          )}

          <div className={styles.visualBackdropGlow}></div>

          <div className={styles.visualOverlay}>
            <div className={styles.visualHeroCard}>
              <span className={styles.summaryLabel}>{activeMissingField ? "Asking now" : "Ready to wrap"}</span>
              <h3>
                {activeMissingField
                  ? REQUIRED_NOTE_PROMPTS[activeMissingField].title
                  : "Everything required is captured."}
              </h3>
              <p>
                {activeMissingField
                  ? REQUIRED_NOTE_PROMPTS[activeMissingField].detail
                  : "The form on the right is complete enough to generate the learning plan whenever you want."}
              </p>

              <div className={styles.visualMetaRow}>
                <span className={styles.visualMetaChip}>
                  {activeMissingField ? REQUIRED_NOTE_LABELS[activeMissingField] : "Plan-ready intake"}
                </span>
                <span className={styles.visualMetaChip}>
                  {lastStructuredUpdate
                    ? `Last sync: ${lastStructuredUpdate.source}`
                    : "Waiting for the next captured field"}
                </span>
              </div>

              <div className={styles.visualSummaryBand}>
                <span className={styles.footerLabel}>Live summary</span>
                <strong>{notes.summary || "The host summary will tighten as more answers come in."}</strong>
              </div>
            </div>

            <div className={styles.visualTopicGrid}>
              {requiredPromptStates.map((entry) => (
                <button
                  key={entry.field}
                  type="button"
                  className={
                    entry.isCaptured
                      ? `${styles.visualTopicCard} ${styles.visualTopicDone}`
                      : entry.isActive
                        ? `${styles.visualTopicCard} ${styles.visualTopicActive}`
                        : `${styles.visualTopicCard} ${styles.visualTopicPending}`
                  }
                  onClick={() => {
                    if (!missingFields.includes(entry.field)) return;
                    setRotatingMissingIndex(missingFields.indexOf(entry.field));
                  }}
                >
                  <span>{entry.isCaptured ? "Done" : entry.isActive ? "Live" : "Queue"}</span>
                  <strong>{REQUIRED_NOTE_LABELS[entry.field]}</strong>
                </button>
              ))}
            </div>

            {latestRequiredFields.length ? (
              <div className={styles.visualUpdateRow}>
                {latestRequiredFields.map((field) => (
                  <span key={`${field}-${lastStructuredUpdate?.timestamp ?? 0}`} className={styles.syncChip}>
                    {NOTE_FIELD_LABELS[field]} updated
                  </span>
                ))}
              </div>
            ) : null}

            {completedPrompts.length ? (
              <div className={styles.visualCompletionRail}>
                {completedPrompts.map((prompt) => (
                  <span key={prompt.id} className={styles.completedChip}>
                    {REQUIRED_NOTE_LABELS[prompt.field]} captured
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );

  const formPanel = (
    <article className={styles.notesPanel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelEyebrow}>Structured intake</div>
          <h2>Bound form</h2>
        </div>
        <div className={styles.notesBoardMeta}>
          <div className={styles.coveragePill}>{coverage}% captured</div>
          <div className={waitingForAssistant ? styles.liveBadgeHot : styles.liveBadge}>
            {waitingForAssistant ? "Responding" : connectionState === "live" ? "Listening" : "Waiting"}
          </div>
        </div>
      </div>

      <div className={styles.summaryCard}>
        <span className={styles.summaryLabel}>Working summary</span>
        <p>{notes.summary || "The host will keep this summary updated as answers come in."}</p>
      </div>

      <div className={styles.variablePanel}>
        <div className={styles.variableHeader}>
          <div>
            <span className={styles.summaryLabel}>Direct variable sync</span>
            <p className={styles.variableCopy}>
              Voice transcript and typed replies write directly into these bound fields. These are the exact values the
              learning-plan generator uses.
            </p>
          </div>
          <div className={styles.syncBadge}>
            {lastStructuredUpdate
              ? `${lastStructuredUpdate.source === "voice" ? "Voice" : lastStructuredUpdate.source === "typed" ? "Typed" : "Manual"} sync`
              : "Waiting"}
          </div>
        </div>

        <div className={styles.syncTrail}>
          {lastStructuredUpdate?.fields.length ? (
            lastStructuredUpdate.fields.map((field) => (
              <span key={`${field}-${lastStructuredUpdate.timestamp}`} className={styles.syncChip}>
                {NOTE_FIELD_LABELS[field]}
              </span>
            ))
          ) : (
            <span className={styles.emptyInline}>No structured variables captured yet.</span>
          )}
        </div>

        <div className={styles.fieldGrid}>
          <label className={styles.fieldCard}>
            <span className={styles.fieldLabel}>Name</span>
            <input
              className={styles.fieldInput}
              name="fullName"
              value={notes.fullName}
              onChange={(event) => updateNoteField("fullName", event.target.value)}
              placeholder="Captured from chat"
            />
          </label>

          <label className={styles.fieldCard}>
            <span className={styles.fieldLabel}>Role</span>
            <input
              className={styles.fieldInput}
              name="jobTitle"
              value={notes.jobTitle}
              onChange={(event) => updateNoteField("jobTitle", event.target.value)}
              placeholder="Captured from chat"
            />
          </label>

          <label className={styles.fieldCard}>
            <span className={styles.fieldLabel}>Learning track</span>
            <select
              className={styles.fieldInput}
              name="careerPathId"
              value={notes.careerPathId}
              onChange={(event) =>
                updateNoteField("careerPathId", event.target.value as OnboardingNotes["careerPathId"])
              }
            >
              <option value="">Waiting to capture</option>
              {CAREER_PATHS.map((path) => (
                <option key={path.id} value={path.id}>
                  {path.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldCard}>
            <span className={styles.fieldLabel}>Track label</span>
            <input
              className={styles.fieldInput}
              name="careerCategoryLabel"
              value={notes.careerCategoryLabel}
              onChange={(event) => updateNoteField("careerCategoryLabel", event.target.value)}
              placeholder={currentCareerPath?.name ?? "Human-readable track label"}
            />
          </label>

          <label className={styles.fieldCard}>
            <span className={styles.fieldLabel}>Experience</span>
            <select
              className={styles.fieldInput}
              name="yearsExperience"
              value={notes.yearsExperience}
              onChange={(event) =>
                updateNoteField("yearsExperience", event.target.value as OnboardingNotes["yearsExperience"])
              }
            >
              <option value="">Waiting to capture</option>
              {Object.entries(EXPERIENCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldCard}>
            <span className={styles.fieldLabel}>Situation</span>
            <select
              className={styles.fieldInput}
              name="situation"
              value={notes.situation}
              onChange={(event) => updateNoteField("situation", event.target.value as OnboardingNotes["situation"])}
            >
              <option value="">Waiting to capture</option>
              {Object.entries(SITUATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldCard}>
            <span className={styles.fieldLabel}>Company size</span>
            <select
              className={styles.fieldInput}
              name="companySize"
              value={notes.companySize}
              onChange={(event) => updateNoteField("companySize", event.target.value as OnboardingNotes["companySize"])}
            >
              <option value="">Optional</option>
              {Object.entries(COMPANY_SIZE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldCard}>
            <span className={styles.fieldLabel}>AI comfort</span>
            <select
              className={styles.fieldInput}
              name="aiComfort"
              value={notes.aiComfort ?? ""}
              onChange={(event) => updateNoteField("aiComfort", event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Waiting to capture</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}/5
                </option>
              ))}
            </select>
          </label>

          <label className={`${styles.fieldCard} ${styles.fieldCardWide}`}>
            <span className={styles.fieldLabel}>Working summary</span>
            <textarea
              className={styles.fieldTextarea}
              name="summary"
              value={notes.summary}
              onChange={(event) => updateNoteField("summary", event.target.value)}
              placeholder="The host keeps this synced from the conversation"
              rows={3}
            />
          </label>

          <label className={`${styles.fieldCard} ${styles.fieldCardWide}`}>
            <span className={styles.fieldLabel}>Day-to-day work</span>
            <textarea
              className={styles.fieldTextarea}
              name="dailyWorkSummary"
              value={notes.dailyWorkSummary}
              onChange={(event) => updateNoteField("dailyWorkSummary", event.target.value)}
              placeholder="Captured from the learner's spoken workflow"
              rows={4}
            />
          </label>

          <label className={`${styles.fieldCard} ${styles.fieldCardWide}`}>
            <span className={styles.fieldLabel}>Tools and skills</span>
            <textarea
              className={styles.fieldTextarea}
              name="keySkills"
              value={notes.keySkills.join(", ")}
              onChange={(event) => updateNoteField("keySkills", parseDelimitedList(event.target.value))}
              placeholder="Comma-separated tools, systems, or skills"
              rows={3}
            />
          </label>

          <div className={`${styles.fieldCard} ${styles.fieldCardWide}`}>
            <span className={styles.fieldLabel}>Goals</span>
            <div className={styles.goalChecklist}>
              {Object.entries(GOAL_LABELS).map(([goal, label]) => (
                <label key={goal} className={styles.goalOption}>
                  <input
                    type="checkbox"
                    checked={notes.selectedGoals.includes(goal as OnboardingNotes["selectedGoals"][number])}
                    onChange={() => toggleGoal(goal as OnboardingNotes["selectedGoals"][number])}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <label className={styles.fieldCard}>
            <span className={styles.fieldLabel}>LinkedIn</span>
            <input
              className={styles.fieldInput}
              name="linkedinUrl"
              value={notes.linkedinUrl}
              onChange={(event) => updateNoteField("linkedinUrl", event.target.value)}
              placeholder="Optional profile URL"
            />
          </label>

          <label className={styles.fieldCard}>
            <span className={styles.fieldLabel}>Resume note</span>
            <input
              className={styles.fieldInput}
              name="resumeFilename"
              value={notes.resumeFilename}
              onChange={(event) => updateNoteField("resumeFilename", event.target.value)}
              placeholder="Optional resume filename"
            />
          </label>

          <div className={`${styles.fieldCard} ${styles.fieldCardWide}`}>
            <span className={styles.fieldLabel}>Live payload</span>
            <pre className={styles.payloadPreview}>{notesPayload}</pre>
          </div>
        </div>
      </div>

      <div className={styles.notesActionRow}>
        <div className={styles.notesPipeline}>
          <div>
            <span className={styles.footerLabel}>Audio path</span>
            <strong>OpenAI Realtime WebRTC</strong>
          </div>
          <div>
            <span className={styles.footerLabel}>Notes path</span>
            <strong>Tool-call extraction + live field sync</strong>
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
      </div>
    </article>
  );

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
          <h1 className={styles.title}>Voice-first onboarding with live form sync.</h1>
          <p className={styles.subtitle}>
            Transcript on the left, active question canvas in the center, and a bound intake form on
            the right -- all synced in realtime as the host captures plan variables from the conversation.
          </p>
        </div>

        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={startOnboardingCall}
            disabled={connectionState === "connecting" || connectionState === "live"}
          >
            {connectionState === "connecting" ? "Connecting..." : connectionState === "live" ? "Live call active" : "Start onboarding"}
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
        <aside className={styles.transcriptColumn}>
          <article className={styles.transcriptPanel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelEyebrow}>Transcript</div>
                <h2>Exact transcript</h2>
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
        </aside>

        <section className={styles.visualColumn}>{promptStagePanel}</section>

        <aside className={styles.formColumn}>{formPanel}</aside>
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
