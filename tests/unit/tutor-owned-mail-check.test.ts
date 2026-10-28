import { afterEach, describe, expect, it, vi } from "vitest";
import { attestationMessage, createOwnedMailCheck, logOwnedMailResult } from "../../apps/worker/src/owned-mail-check";
import { lifecycleFromAddress, sendResendEmail } from "../../apps/worker/src/resend-email";

const RUN = "tutor-20261028p-b96d3a2f4c7e41be";
const FROM = "AI Tutor <onboarding@resend.dev>";
const NOW = Date.parse("2026-10-28T22:00:00Z");
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("owned mail approval gate", () => {
  it("is disabled by default and for wrong gate, expiration, and sender drift", async () => {
    const send = vi.fn(); const run = createOwnedMailCheck();
    expect(await run(undefined, NOW, FROM, send)).toBe("disabled");
    expect(await run("wrong", NOW, FROM, send)).toBe("disabled");
    expect(await run(RUN, Date.parse("2026-10-29T20:00:00Z"), FROM, send)).toBe("expired");
    expect(await run(RUN, NOW, "other", send)).toBe("sender_mismatch");
    expect(send).not.toHaveBeenCalled();
  });
  it("uses the real worker send function exactly once with stable idempotency and fixed content", async () => {
    vi.stubEnv("RESEND_API_KEY", "fake-local-secret"); vi.stubEnv("RESEND_FROM_EMAIL", "");
    const fetchMock = vi.fn().mockResolvedValue({ok:true,json:async()=>({id:"6ba7b810-9dad-11d1-80b4-00c04fd430c8"})}); vi.stubGlobal("fetch",fetchMock);
    const run = createOwnedMailCheck();
    expect(await run(RUN, NOW, lifecycleFromAddress(), sendResendEmail)).toEqual({acceptedId:"6ba7b810-9dad-11d1-80b4-00c04fd430c8"});
    expect(await run(RUN, NOW, FROM, sendResendEmail)).toBe("disabled");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(request.headers["Idempotency-Key"]).toBe(RUN);
    expect(JSON.parse(request.body)).toEqual({from:FROM,to:["msanchezgrice@gmail.com"],subject:"AI Tutor security verification 2026-10-28p",html:"<p>This is a one-time test of the AI Tutor worker email configuration.</p>",text:"This is a one-time test of the AI Tutor worker email configuration."});
  });
  it("does not automatically retry a 503 or ambiguous request, and masks provider details", async () => {
    vi.stubEnv("RESEND_API_KEY", "fake-local-secret");
    const fetchMock = vi.fn().mockResolvedValue({ok:false,status:503,text:async()=>"fake-local-secret"}); vi.stubGlobal("fetch",fetchMock);
    const run = createOwnedMailCheck();
    expect(await run(RUN, NOW, FROM, sendResendEmail)).toBe("failed");
    expect(await run(RUN, NOW, FROM, sendResendEmail)).toBe("disabled");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("uses the same key and payload across a new process within the bounded window", async () => {
    vi.stubEnv("RESEND_API_KEY", "fake-local-secret");
    const fetchMock = vi.fn().mockResolvedValue({ok:true,json:async()=>({id:"6ba7b810-9dad-11d1-80b4-00c04fd430c8"})}); vi.stubGlobal("fetch",fetchMock);
    await createOwnedMailCheck()(RUN,NOW,FROM,sendResendEmail);
    await createOwnedMailCheck()(RUN,NOW,FROM,sendResendEmail);
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe(fetchMock.mock.calls[1][1].headers["Idempotency-Key"]);
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
  });
  it("logs only a presence boolean and an allowlisted outcome, never provider details or credentials", async () => {
    const logs: string[] = [];
    const secret = "fake-local-secret";
    const send = vi.fn().mockResolvedValue({ ok: false, detail: secret });
    const result = await createOwnedMailCheck()(RUN, NOW, FROM, send);
    logs.push(attestationMessage("v24.22.1", secret));
    logOwnedMailResult(result, (message) => logs.push(message));
    expect(logs).toEqual(["[worker] attestation release=tutor-20261028p node=v24.22.1 resendKeyPresent=true", "[worker] owned-mail-check result=failed"]);
    expect(logs.join(" ")).not.toContain(secret);
    expect(logs.join(" ")).not.toContain("msanchezgrice@gmail.com");
  });
  it("preserves ordinary sends without an idempotency header", async () => {
    vi.stubEnv("RESEND_API_KEY", "fake-local-secret");
    const f = vi.fn().mockResolvedValue({ok:true,json:async()=>({id:"local"})}); vi.stubGlobal("fetch",f);
    await sendResendEmail({to:"fixture@example.invalid", subject:"fixture", html:"fixture", text:"fixture"});
    expect(f.mock.calls[0][1].headers).not.toHaveProperty("Idempotency-Key");
  });

  it("reports UUID receipts and safely classifies missing or malformed message IDs", async () => {
    const logs: string[] = [];
    for (const id of ["6ba7b810-9dad-11d1-80b4-00c04fd430c8", null, "fake-local-secret"]) {
      const result = await createOwnedMailCheck()(RUN, NOW, FROM, vi.fn().mockResolvedValue({ok:true,messageId:id}));
      logOwnedMailResult(result, (msg) => logs.push(msg));
    }
    expect(logs).toEqual(["[worker] owned-mail-check result=accepted messageId=6ba7b810-9dad-11d1-80b4-00c04fd430c8", "[worker] owned-mail-check result=accepted_without_id", "[worker] owned-mail-check result=accepted_without_id"]);
    expect(logs.join(" ")).not.toContain("fake-local-secret");
  });

});
