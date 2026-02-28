"use client";

import { useState, useEffect, useCallback } from "react";
import { startEvaluation, getEvaluations, getEvaluationDetail } from "@/lib/api";
import { Loader2, Play, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Clock } from "lucide-react";

interface EvalRun {
  id: string;
  faithfulness: number | null;
  answer_relevancy: number | null;
  context_precision: number | null;
  question_count: number;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface EvalResult {
  question_index: number;
  question: string;
  ground_truth: string;
  generated_answer: string;
  retrieved_contexts: string[];
  faithfulness: number | null;
  answer_relevancy: number | null;
  context_precision: number | null;
}

interface EvalDetail extends EvalRun {
  results: EvalResult[];
}

function scoreColor(score: number | null): string {
  if (score === null) return "#D3DAD9";
  if (score >= 0.8) return "#10a37f";
  if (score >= 0.5) return "#d4a574";
  return "#ef4444";
}

function scoreBg(score: number | null): string {
  if (score === null) return "#37353E";
  if (score >= 0.8) return "#10a37f15";
  if (score >= 0.5) return "#d4a57415";
  return "#ef444415";
}

function scoreLabel(score: number | null): string {
  if (score === null) return "—";
  return (score * 100).toFixed(1) + "%";
}

function statusLabel(status: string): string {
  switch (status) {
    case "generating_questions": return "Generating questions...";
    case "querying": return "Running queries...";
    case "scoring": return "Scoring with RAGAS...";
    case "running": return "Starting...";
    case "completed": return "Completed";
    case "failed": return "Failed";
    default: return status;
  }
}

const ACTIVE_STATUSES = ["running", "generating_questions", "querying", "scoring"];

function ScoreCard({ label, score }: { label: string; score: number | null }) {
  return (
    <div
      className="flex-1 rounded-lg p-4 text-center"
      style={{ backgroundColor: scoreBg(score), border: `1px solid ${scoreColor(score)}30` }}
    >
      <p className="text-xs mb-1.5" style={{ color: "#D3DAD9", opacity: 0.5 }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: scoreColor(score) }}>
        {scoreLabel(score)}
      </p>
    </div>
  );
}

function QuestionRow({ result, index }: { result: EvalResult; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: "#37353E", border: "1px solid #715A5A30" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:brightness-110 transition-all"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "#D3DAD9", opacity: 0.4 }} />
        ) : (
          <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#D3DAD9", opacity: 0.4 }} />
        )}
        <span className="text-xs font-mono flex-shrink-0" style={{ color: "#D3DAD9", opacity: 0.3 }}>
          Q{index + 1}
        </span>
        <span className="text-sm flex-1 truncate" style={{ color: "#D3DAD9" }}>
          {result.question}
        </span>
        <div className="flex gap-3 flex-shrink-0">
          <span className="text-xs font-medium" style={{ color: scoreColor(result.faithfulness) }}>
            F: {scoreLabel(result.faithfulness)}
          </span>
          <span className="text-xs font-medium" style={{ color: scoreColor(result.answer_relevancy) }}>
            R: {scoreLabel(result.answer_relevancy)}
          </span>
          <span className="text-xs font-medium" style={{ color: scoreColor(result.context_precision) }}>
            P: {scoreLabel(result.context_precision)}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid #715A5A20" }}>
          <div className="pt-3">
            <p className="text-xs font-medium mb-1" style={{ color: "#D3DAD9", opacity: 0.5 }}>Expected Answer</p>
            <p className="text-sm" style={{ color: "#D3DAD9", opacity: 0.8 }}>{result.ground_truth}</p>
          </div>
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "#D3DAD9", opacity: 0.5 }}>Chatbot's Answer</p>
            <p className="text-sm" style={{ color: "#D3DAD9", opacity: 0.8 }}>{result.generated_answer}</p>
          </div>
          {result.retrieved_contexts.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "#D3DAD9", opacity: 0.5 }}>
                Retrieved Contexts ({result.retrieved_contexts.length})
              </p>
              <div className="space-y-2">
                {result.retrieved_contexts.map((ctx, i) => (
                  <div
                    key={i}
                    className="text-xs p-2.5 rounded"
                    style={{ backgroundColor: "#2D2B33", color: "#D3DAD9", opacity: 0.7 }}
                  >
                    {ctx.length > 300 ? ctx.slice(0, 300) + "..." : ctx}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EvaluationTab({ chatbotId }: { chatbotId: string }) {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [detail, setDetail] = useState<EvalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeRun = runs.find((r) => ACTIVE_STATUSES.includes(r.status));
  const latestCompleted = runs.find((r) => r.status === "completed");

  const fetchRuns = useCallback(async () => {
    try {
      const data = await getEvaluations(chatbotId);
      setRuns(data);
      return data;
    } catch {
      setError("Failed to load evaluations");
      return [];
    }
  }, [chatbotId]);

  const fetchDetail = useCallback(async (evalId: string) => {
    try {
      const data = await getEvaluationDetail(chatbotId, evalId);
      setDetail(data);
    } catch {
      // detail fetch failed, not critical
    }
  }, [chatbotId]);

  // Initial load
  useEffect(() => {
    async function init() {
      const data = await fetchRuns();
      const completed = data.find((r: EvalRun) => r.status === "completed");
      if (completed) await fetchDetail(completed.id);
      setLoading(false);
    }
    init();
  }, [fetchRuns, fetchDetail]);

  // Poll while evaluation is running
  useEffect(() => {
    if (!activeRun) return;

    const interval = setInterval(async () => {
      const data = await fetchRuns();
      const stillRunning = data.find((r: EvalRun) => ACTIVE_STATUSES.includes(r.status));

      if (!stillRunning) {
        const completed = data.find((r: EvalRun) => r.status === "completed");
        if (completed) await fetchDetail(completed.id);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeRun, fetchRuns, fetchDetail]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      await startEvaluation(chatbotId);
      await fetchRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start evaluation");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#D3DAD9", opacity: 0.4 }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Run Button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: "#D3DAD9", opacity: 0.5 }}>
            Auto-generates questions from your documents, runs them through the chatbot, and scores the responses with RAGAS metrics.
          </p>
        </div>
        <button
          onClick={handleStart}
          disabled={starting || !!activeRun}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer hover:brightness-110 flex-shrink-0"
          style={{
            backgroundColor: "#715A5A",
            color: "#D3DAD9",
            opacity: starting || activeRun ? 0.5 : 1,
          }}
        >
          {starting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {activeRun ? "Running..." : "Run Evaluation"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ backgroundColor: "#ef444420", color: "#ef4444" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Active Run Progress */}
      {activeRun && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg"
          style={{ backgroundColor: "#715A5A20", border: "1px solid #715A5A40" }}
        >
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#715A5A" }} />
          <div>
            <p className="text-sm font-medium" style={{ color: "#D3DAD9" }}>{statusLabel(activeRun.status)}</p>
            <p className="text-xs mt-0.5" style={{ color: "#D3DAD9", opacity: 0.4 }}>
              This may take a few minutes depending on the number of documents
            </p>
          </div>
        </div>
      )}

      {/* Latest Failed Run */}
      {!activeRun && runs[0]?.status === "failed" && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg"
          style={{ backgroundColor: "#ef444415", border: "1px solid #ef444430" }}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#ef4444" }} />
          <div>
            <p className="text-sm font-medium" style={{ color: "#ef4444" }}>Evaluation Failed</p>
            {runs[0].error_message && (
              <p className="text-xs mt-0.5" style={{ color: "#D3DAD9", opacity: 0.5 }}>{runs[0].error_message}</p>
            )}
          </div>
        </div>
      )}

      {/* Score Cards */}
      {latestCompleted && (
        <>
          <div className="flex gap-3">
            <ScoreCard label="Faithfulness" score={latestCompleted.faithfulness} />
            <ScoreCard label="Answer Relevancy" score={latestCompleted.answer_relevancy} />
            <ScoreCard label="Context Precision" score={latestCompleted.context_precision} />
          </div>

          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#10a37f" }} />
            <span className="text-xs" style={{ color: "#D3DAD9", opacity: 0.4 }}>
              {latestCompleted.question_count} questions • completed{" "}
              {latestCompleted.completed_at
                ? new Date(latestCompleted.completed_at).toLocaleString()
                : ""}
            </span>
          </div>
        </>
      )}

      {/* Per-Question Breakdown */}
      {detail && detail.results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium" style={{ color: "#D3DAD9", opacity: 0.7 }}>
            Question Breakdown
          </p>
          {detail.results.map((r, i) => (
            <QuestionRow key={r.question_index} result={r} index={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!activeRun && !latestCompleted && runs[0]?.status !== "failed" && (
        <div className="text-center py-12">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "#715A5A20" }}
          >
            <Play className="w-7 h-7" style={{ color: "#715A5A" }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "#D3DAD9" }}>No evaluations yet</p>
          <p className="text-xs" style={{ color: "#D3DAD9", opacity: 0.4 }}>
            Run an evaluation to see how well your chatbot answers questions from its documents
          </p>
        </div>
      )}
    </div>
  );
}