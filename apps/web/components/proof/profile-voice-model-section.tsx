// FOUNDATION-SEED (owner: workstream E, voice model). The public profile page
// (workstream D) renders this section; workstream E replaces the body with the
// real "Try my model" section and removes this marker. Must return null when
// the learner has no published model.
export async function ProfileVoiceModelSection(_props: { learnerProfileId: string; handle: string; displayName: string }) {
  return null;
}
