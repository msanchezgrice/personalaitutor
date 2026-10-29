"use client";

import { useId, useState } from "react";
import { buildCareerPlan, buildResumeEvidence, careerDirections, mapExperience, type CareerToolMode } from "@/lib/career-tools";

const modes: { id: CareerToolMode; label: string; description: string }[] = [
  { id: "map", label: "Experience mapper", description: "Start with tasks you actually performed. See possible directions, the task behind each suggestion, and what you still need to investigate." },
  { id: "resume", label: "Resume evidence builder", description: "Turn one independent project into an accurate draft. Your answers supply the claims; this exercise does not verify them or invent results." },
  { id: "reset", label: "Career reset planner", description: "Choose a direction to investigate and a realistic weekly time budget. Get a first-week search and learning plan." },
  { id: "proof", label: "Proof project planner", description: "Define one small work sample with completion checks and an evidence package that someone else can inspect." },
  { id: "gaming", label: "Gaming transition mapper", description: "Translate studio tasks into possible work in adjacent teams. A shared task does not establish that you qualify for a new role." },
];

const inputClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";
const example = "I tested game releases and reproduced bugs.\nI coordinated release handoffs.\nI analyzed player feedback reports.";

export function CareerTools({ initialMode = "map" }: { initialMode?: CareerToolMode }) {
  const id = useId();
  const [mode, setMode] = useState<CareerToolMode>(initialMode);
  const [tasks, setTasks] = useState("");
  const [action, setAction] = useState("");
  const [output, setOutput] = useState("");
  const [check, setCheck] = useState("");
  const [evidence, setEvidence] = useState("");
  const [status, setStatus] = useState<"planned" | "completed">("planned");
  const [direction, setDirection] = useState("quality");
  const [hours, setHours] = useState("2");
  const [result, setResult] = useState("");
  const [suggestions, setSuggestions] = useState<ReturnType<typeof mapExperience>>([]);
  const [ran, setRan] = useState(false);
  const selected = modes.find((entry) => entry.id === mode)!;
  const mapping = mode === "map" || mode === "gaming";

  function invalidate() { setResult(""); setSuggestions([]); setRan(false); }
  function reset() {
    invalidate(); setTasks(""); setAction(""); setOutput(""); setCheck(""); setEvidence(""); setStatus("planned"); setDirection("quality"); setHours("2");
  }
  function run() {
    setRan(true);
    if (mapping) {
      const mapped = mapExperience(tasks);
      setSuggestions(mapped);
      setResult(mapped.length ? ["Possible career directions — editorial task patterns, not a qualification assessment.", `Your reported tasks:\n${tasks}`, ...mapped.map((entry) => `${entry.title}\nPossible capability: ${entry.capability}\nReported tasks: ${entry.evidence.join("; ")}\nStill to investigate: ${entry.gaps.join("; ")}`)].join("\n\n") : "");
    } else if (mode === "resume") {
      setResult(buildResumeEvidence({ action, output, check, evidence, status }));
    } else { setResult(buildCareerPlan(direction, hours, mode)); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([`My AI Skill Tutor — ${selected.label}\n\n${result}\n\nCreated with a browser exercise. Review and edit before sharing.\n`], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `career-${mode}-notes.txt`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section id="career-tool" aria-labelledby={`${id}-title`} className="career-tools mb-12 scroll-mt-48 rounded-3xl border border-emerald-200 bg-white p-5 text-slate-900 shadow-sm sm:p-8">
    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-800">Try the exercise · free · no account</p>
    <h2 id={`${id}-title`} className="text-3xl font-semibold">Put your experience to work</h2>
    <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">Map what you have done, choose a next step, and keep your own notes. These exercises run in your browser without an AI service. Answers are not saved here; download them before leaving or refreshing. Use nonconfidential examples.</p>
    <label htmlFor={`${id}-mode`} className="mt-6 block max-w-xl text-sm font-semibold">Choose an exercise
      <select id={`${id}-mode`} className={inputClass} value={mode} onChange={(event) => { setMode(event.target.value as CareerToolMode); invalidate(); }}>
        {modes.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
      </select>
    </label>
    <div className="mt-6 border-t border-slate-200 pt-6">
      <h3 className="text-2xl font-semibold">{selected.label}</h3>
      <p className="mt-2 max-w-3xl leading-7 text-slate-600">{selected.description}</p>
      {/* Block this whole subtree from autocapture and replay; includes generated text. */}
      <div className="ph-no-capture ph-mask ph-block" data-ph-no-capture>
        <form className="mt-5 space-y-5" onSubmit={(event) => { event.preventDefault(); run(); }} onChange={invalidate}>
          {mapping ? <div>
            <label htmlFor={`${id}-tasks`} className="block text-sm font-semibold">What tasks did you actually do? One per line.</label>
            <textarea id={`${id}-tasks`} className={inputClass} rows={5} maxLength={3000} required value={tasks} onChange={(event) => setTasks(event.target.value)} placeholder={mode === "gaming" ? "I reproduced gameplay bugs and wrote steps to recreate them." : "I analyzed monthly reports and explained unusual results."} aria-describedby={`${id}-task-help`} />
            <p id={`${id}-task-help`} className="mt-2 text-sm text-slate-600">Use actions and outputs, rather than only a title. Suggestions use a small set of English task patterns; missing suggestions do not mean missing skills.</p>
            <button type="button" className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50" onClick={() => { setTasks(example); invalidate(); }}>Use fictional gaming example</button>
          </div> : mode === "resume" ? <>
            <label className="block text-sm font-semibold" htmlFor={`${id}-status`}>Project status
              <select id={`${id}-status`} className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as "planned" | "completed")}><option value="planned">Planned — I have not completed it</option><option value="completed">Completed — self-reported</option></select>
            </label>
            {([{ key: "action", label: "What did you actually do?", value: action, setter: setAction, hint: "For a planned project, describe what you intend to do." }, { key: "output", label: "What output did you produce?", value: output, setter: setOutput, hint: "For example, a report, prototype, or test set. If planned, describe the intended output." }, { key: "check", label: "How did you check the work?", value: check, setter: setCheck, hint: "Name the checks you ran, or plan to run. Include limitations." }] as const).map((field) => <label key={field.key} htmlFor={`${id}-${field.key}`} className="block text-sm font-semibold">{field.label}<textarea id={`${id}-${field.key}`} className={inputClass} rows={2} maxLength={1500} required value={field.value} onChange={(event) => field.setter(event.target.value)} aria-describedby={`${id}-${field.key}-help`} /><span id={`${id}-${field.key}-help`} className="mt-1 block text-sm font-normal text-slate-600">{field.hint}</span></label>)}
            <label htmlFor={`${id}-evidence`} className="block text-sm font-semibold">Evidence location or link (optional)<input id={`${id}-evidence`} className={inputClass} maxLength={1500} value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="A public demo or your own file reference" /></label>
          </> : <div className="grid gap-5 sm:grid-cols-2">
            <label htmlFor={`${id}-direction`} className="block text-sm font-semibold">Direction to investigate<select id={`${id}-direction`} className={inputClass} value={direction} onChange={(event) => setDirection(event.target.value)}>{careerDirections.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label>
            <label htmlFor={`${id}-hours`} className="block text-sm font-semibold">Weekly time budget<select id={`${id}-hours`} className={inputClass} value={hours} onChange={(event) => setHours(event.target.value)}><option value="2">2 hours per week</option><option value="5">5 hours per week</option><option value="10">10 hours per week</option></select></label>
          </div>}
          <div className="flex flex-wrap gap-3"><button type="submit" className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white hover:bg-emerald-900">{mapping ? "Explore possible directions" : mode === "resume" ? "Build my evidence draft" : "Create my plan"}</button><button type="button" onClick={reset} className="rounded-xl border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50">Clear answers</button></div>
        </form>
        <div aria-live="polite" aria-atomic="true" className="mt-6">
          {ran && !result ? <p role="status" className="rounded-xl bg-amber-50 p-4 leading-7 text-amber-950">{mapping ? "No direction suggested from these task patterns. Try a specific action and output, or use the workbook to map your experience manually. This exercise cannot assess every kind of work." : "Add an action, an output, and a quality check to create an evidence draft."}</p> : null}
          {result ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-6" data-testid="career-tool-result">
            <h3 className="text-xl font-semibold">Your draft — review and edit before using</h3>
            {mapping ? <div className="mt-4 space-y-5">{suggestions.map((entry) => <div key={entry.id} className="rounded-xl bg-white p-4"><h4 className="font-semibold">{entry.title}</h4><p className="mt-2 text-sm leading-6">Possible capability: {entry.capability}</p><p className="mt-2 text-sm font-semibold">Based on your reported tasks:</p><ul className="ml-5 list-disc break-words text-sm leading-7">{entry.evidence.map((line) => <li key={line}>{line}</li>)}</ul><p className="mt-3 text-sm"><strong>Still to investigate:</strong> {entry.gaps.join("; ")}. These have not been assessed.</p></div>)}<p className="text-sm leading-7">Choose one direction to investigate with the proof project planner above. These are editorial suggestions based on task words, not verified skills, live vacancies, or hiring predictions.</p></div> : <p className="mt-4 whitespace-pre-wrap break-words text-base leading-7">{result}</p>}
            <button type="button" onClick={download} className="mt-5 rounded-xl border border-emerald-800 bg-white px-4 py-3 font-semibold text-emerald-900 hover:bg-emerald-100">Download my notes (.txt)</button>
          </div> : null}
        </div>
      </div>
    </div>
    <p className="mt-6 text-sm leading-7 text-slate-600">Prefer paper? <a className="font-semibold text-emerald-800 underline underline-offset-4" href="/downloads/career-remapping-workbook.pdf" download>Download the printable workbook</a>. For broader occupation research, compare <a className="text-emerald-800 underline underline-offset-4" href="https://www.onetonline.org/find/descriptor/browse/2.B/2.B.2">O*NET transferable skills</a> with current employer requirements.</p>
    <noscript><p className="mt-4">Enable JavaScript to use the exercises, or download the printable workbook above.</p></noscript>
  </section>;
}
