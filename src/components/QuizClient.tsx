"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicQuizQuestion } from "@/lib/public";
import { trackQuizSession } from "@/lib/quiz-tracking";

export const QUIZ_STORAGE_KEY = "yuzuu.quiz";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function QuizClient({
  handle,
  questions,
  isPreview = false,
}: {
  handle: string;
  questions: PublicQuizQuestion[];
  /** The creator walking their own funnel — no session tracking. */
  isPreview?: boolean;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);

  // funnel session — created on the first answer, then kept in sync
  const sessionIdRef = useRef<string | null>(null);
  const creatingRef = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = questions.length;
  const onEmailStep = idx === total;
  const q = onEmailStep ? null : questions[idx];
  const progress = (idx / (total + 1)) * 100;

  function ensureSession(withAnswers: Record<string, string | string[]>) {
    if (isPreview) return;
    if (sessionIdRef.current || creatingRef.current) return;
    creatingRef.current = true;
    trackQuizSession({ handle, answers: withAnswers, lastQuestionIdx: idx }).then((id) => {
      creatingRef.current = false;
      if (id) sessionIdRef.current = id;
    });
  }

  /** Debounced progress sync — never blocks the UI. */
  function scheduleSync(nextAnswers: Record<string, string | string[]>, nextIdx: number) {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      if (!sessionIdRef.current) return;
      trackQuizSession({
        handle,
        sessionId: sessionIdRef.current,
        answers: nextAnswers,
        lastQuestionIdx: nextIdx,
      });
    }, 800);
  }

  useEffect(() => () => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
  }, []);

  // "What we've picked up" — the labels of everything chosen so far
  const notes = useMemo(() => {
    const out: string[] = [];
    for (const question of questions.slice(0, idx)) {
      const a = answers[question.id];
      if (!a) continue;
      const ids = Array.isArray(a) ? a : [a];
      for (const id of ids) {
        const opt = question.options.find((o) => o.id === id);
        if (opt) out.push(opt.label);
      }
    }
    return out;
  }, [answers, idx, questions]);

  const current = q ? answers[q.id] : undefined;
  const answered = Array.isArray(current) ? current.length > 0 : Boolean(current);
  const emailValid = EMAIL_RE.test(email.trim());

  function toggle(optionId: string) {
    if (!q) return;
    setAnswers((prev) => {
      let next: Record<string, string | string[]>;
      if (q.type === "multi") {
        const list = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : [];
        next = {
          ...prev,
          [q.id]: list.includes(optionId) ? list.filter((x) => x !== optionId) : [...list, optionId],
        };
      } else {
        next = { ...prev, [q.id]: optionId };
      }
      ensureSession(next);
      scheduleSync(next, idx);
      return next;
    });
  }

  function next() {
    if (onEmailStep) {
      if (!emailValid) {
        setEmailTouched(true);
        return;
      }
      const cleanEmail = email.trim().toLowerCase();
      if (!isPreview && sessionIdRef.current) {
        trackQuizSession({
          handle,
          sessionId: sessionIdRef.current,
          answers,
          status: "quiz_completed",
          email: cleanEmail,
        });
      }
      sessionStorage.setItem(
        QUIZ_STORAGE_KEY,
        JSON.stringify({ handle, answers, sessionId: sessionIdRef.current, email: cleanEmail })
      );
      router.push(`/u/${handle}/checkout`);
      return;
    }
    if (!answered && q?.required) return;
    setIdx(idx + 1);
    scheduleSync(answers, idx + 1);
  }

  function isChecked(optionId: string) {
    return Array.isArray(current) ? current.includes(optionId) : current === optionId;
  }

  return (
    <>
      <div className="progress">
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="quizwrap">
        <aside className="notes">
          <div className="notes-hd">
            <span className="micro">What we&apos;ve picked up</span>
          </div>
          {notes.length ? (
            <ul>
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : (
            <p className="notes-empty">Your answers shape the plan. They&apos;ll show up here.</p>
          )}
        </aside>

        {onEmailStep ? (
          <div className="q-panel">
            <div className="eyebrow">
              <em>One last thing</em>
            </div>
            <h1>Where should your plan go?</h1>
            <p className="help">
              Your answers are turned into a plan written for your situation — it&apos;s prepared
              for this address.
            </p>

            <div className="field" style={{ marginTop: 22 }}>
              <input
                type="email"
                value={email}
                placeholder="you@example.com"
                autoFocus
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") next();
                }}
              />
            </div>
            {emailTouched && !emailValid ? (
              <p className="hint" style={{ color: "#c96f2f", marginTop: 8 }}>
                That email doesn&apos;t look right — check it and try again.
              </p>
            ) : null}

            <div className="quiz-nav">
              <button className="btn btn-ghost" onClick={() => setIdx(total - 1)}>
                Back
              </button>
              <button className="btn btn-primary" onClick={next} disabled={!emailValid}>
                See my plan
              </button>
            </div>
          </div>
        ) : q ? (
          <div className="q-panel">
            <div className="eyebrow">
              <em>
                Question {idx + 1} of {total}
              </em>
            </div>
            <h1>{q.question}</h1>
            {q.help ? <p className="help">{q.help}</p> : null}
            {q.type === "multi" ? <p className="help">Pick all that apply.</p> : null}

            <div className="opts" role={q.type === "multi" ? "group" : "radiogroup"}>
              {q.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="opt"
                  role={q.type === "multi" ? "checkbox" : "radio"}
                  aria-checked={isChecked(o.id)}
                  onClick={() => toggle(o.id)}
                >
                  <span className="opt-mark">
                    <i />
                  </span>
                  <span>
                    <span className="opt-t">{o.label}</span>
                    {o.sub ? <span className="opt-s">{o.sub}</span> : null}
                  </span>
                </button>
              ))}
            </div>

            <div className="quiz-nav">
              <button
                className="btn btn-ghost"
                onClick={() => setIdx(Math.max(0, idx - 1))}
                disabled={idx === 0}
              >
                Back
              </button>
              <button className="btn btn-primary" onClick={next} disabled={q.required && !answered}>
                Continue
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
