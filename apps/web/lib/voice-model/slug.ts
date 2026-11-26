/**
 * Voice model slugs: the public URL segment of a model
 * (`/api/voice-models/public/{handle}/{slug}/run`). Derived from the name once,
 * unique per learner.
 */

export const VOICE_MODEL_SLUG_MAX = 48;

export function slugifyVoiceModelName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, VOICE_MODEL_SLUG_MAX)
    .replace(/-+$/g, "");
  return slug || "voice-model";
}

/** `base`, or `base-2`, `base-3`... whichever is not in `taken`. */
export function uniqueVoiceModelSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const tail = `-${suffix}`;
    const candidate = `${base.slice(0, VOICE_MODEL_SLUG_MAX - tail.length).replace(/-+$/g, "")}${tail}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("VOICE_MODEL_SLUG_EXHAUSTED");
}

export function isValidVoiceModelSlug(value: string): boolean {
  return value.length > 0 && value.length <= VOICE_MODEL_SLUG_MAX && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
