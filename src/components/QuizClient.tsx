"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicQuizQuestion } from "@/lib/public";

export const QUIZ_STORAGE_KEY = "yuzuu.quiz";

export function QuizClient({
  handle,
  questions,
}: {
  handle: string;
  questions: PublicQuizQuestion[];
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const q = questions[idx];
  const total = questions.length;
  const progress = (idx / total) * 100;

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

  const current = answers[q.id];
  const answered = Array.isArray(current) ? current.length > 0 : Boolean(current);

  function toggle(optionId: string) {
    setAnswers((prev) => {
      if (q.type === "multi") {
        const list = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : [];
        return {
          ...prev,
          [q.id]: list.includes(optionId) ? list.filter((x) => x !== optionId) : [...list, optionId],
        };
      }
      return { ...prev, [q.id]: optionId };
    });
  }

  function next() {
    if (!answered && q.required) return;
    if (idx + 1 < total) {
      setIdx(idx + 1);
      return;
    }
    sessionStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify({ handle, answers }));
    router.push(`/u/${handle}/checkout`);
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
            <button className="btn btn-ghost" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>
              Back
            </button>
            <button className="btn btn-primary" onClick={next} disabled={q.required && !answered}>
              {idx + 1 === total ? "See my plan" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
