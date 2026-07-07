/**
 * Client-safe quiz definition for the anonymous assessment. Kept separate from
 * `assessment-report.ts` (server-only) so the quiz UI can import it.
 */

export const ASSESSMENT_QUIZ_QUESTIONS = [
  {
    id: "ai_tool_frequency",
    question: "How often do you use AI tools in your actual work (not just trying them out)?",
    lowLabel: "Never",
    highLabel: "Every day",
  },
  {
    id: "prompt_skill",
    question: "When you ask an AI tool for something, how often is the result usable within one or two tries?",
    lowLabel: "Rarely usable",
    highLabel: "Almost always",
  },
  {
    id: "workflow_automation",
    question: "Have you automated a recurring work task end-to-end with AI?",
    lowLabel: "Not yet",
    highLabel: "Several, running weekly",
  },
  {
    id: "ai_judgment",
    question: "How confident are you judging whether AI output is correct and safe to ship?",
    lowLabel: "Not confident",
    highLabel: "Very confident",
  },
  {
    id: "ai_artifacts",
    question: "Have you produced work artifacts with AI (docs, code, decks) you would show a colleague or employer?",
    lowLabel: "None yet",
    highLabel: "A portfolio of them",
  },
] as const;

export type AssessmentQuizQuestionId = (typeof ASSESSMENT_QUIZ_QUESTIONS)[number]["id"];

export type AssessmentAnswer = {
  questionId: string;
  value: number;
};
