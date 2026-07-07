"use client";

import { useEffect, useRef } from "react";
import { captureAnalyticsEvent } from "@/lib/analytics";

export function AssessmentReportTracking(props: {
  anonymousAssessmentId: string;
  score: number;
  careerPathId?: string | null;
  emailCaptured: boolean;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    captureAnalyticsEvent("assessment_report_viewed", {
      funnel: "anonymous_assessment",
      anonymous_assessment_id: props.anonymousAssessmentId,
      score: props.score,
      career_path_id: props.careerPathId ?? null,
      email_captured: props.emailCaptured,
    });
  }, [props.anonymousAssessmentId, props.careerPathId, props.emailCaptured, props.score]);

  return null;
}
