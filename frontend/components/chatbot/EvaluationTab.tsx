"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { startEvaluation, getEvaluations, getEvaluationDetail } from "@/lib/api";
import {
  Loader2, Play, ChevronDown, ChevronRight, AlertCircle,
  CheckCircle2, Plus, Trash2, Upload, X,
} from "lucide-react";

interface QAPair {
  question: string;
  ground_truth: string;
}

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
    case "querying": return "Running queries...";
    case "scoring": return "Scoring with RAGAS...";
    case "running": return "Starting...";
    case "completed": return "Completed";
    case "failed": return "Failed";
    default: return status;
  }
}

const ACTIVE_STATUSES = ["running", "querying", "scoring"];

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
            <p className="text-xs font-medium mb-1" style={{ color: "#D3DAD9", opacity: 0.5 }}>Chatbot&apos;s Answer</p>
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
  const [qaPairs, setQaPairs] = useState<QAPair[]>([{ question: "", ground_truth: "" }]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch { /* */ }
  }, [chatbotId]);

  useEffect(() => {
    async function init() {
      const data = await fetchRuns();
      const completed = data.find((r: EvalRun) => r.status === "completed");
      if (completed) await fetchDetail(completed.id);
      setLoading(false);
    }
    init();
  }, [fetchRuns, fetchDetail]);

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

  const addPair = () => {
    setQaPairs((prev) => [...prev, { question: "", ground_truth: "" }]);
  };

  const removePair = (index: number) => {
    setQaPairs((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePair = (index: number, field: "question" | "ground_truth", value: string) => {
    setQaPairs((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);

        if (!Array.isArray(data)) {
          setUploadError("JSON must be an array of objects");
          return;
        }

        const pairs: QAPair[] = [];
        for (const item of data) {
          if (item.question && item.ground_truth) {
            pairs.push({ question: String(item.question).trim(), ground_truth: String(item.ground_truth).trim() });
          }
        }

        if (pairs.length === 0) {
          setUploadError('No valid pairs found. Each object needs "question" and "ground_truth" fields.');
          return;
        }

        setQaPairs(pairs);
      } catch {
        setUploadError("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-uploaded
    e.target.value = "";
  };

  const validPairs = qaPairs.filter((p) => p.question.trim() && p.ground_truth.trim());

  const handleStart = async () => {
    if (validPairs.length === 0) {
      setError("Add at least one question-answer pair");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      await startEvaluation(chatbotId, validPairs);
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
      {/* Description */}
      <p className="text-sm" style={{ color: "#D3DAD9", opacity: 0.5 }}>
        Provide test questions with expected answers. Bouldy will run each question through the chatbot and score responses using RAGAS metrics.
      </p>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ backgroundColor: "#ef444420", color: "#ef4444" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Q&A Input Section */}
      {!activeRun && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: "#D3DAD9", opacity: 0.7 }}>
              Test Questions ({validPairs.length} valid)
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleJsonUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all hover:brightness-110"
                style={{ backgroundColor: "#37353E", color: "#D3DAD9", border: "1px solid #715A5A40" }}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload JSON
              </button>
              <button
                onClick={addPair}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all hover:brightness-110"
                style={{ backgroundColor: "#715A5A", color: "#D3DAD9" }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>

          {uploadError && (
            <p className="text-xs" style={{ color: "#ef4444" }}>{uploadError}</p>
          )}

          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {qaPairs.map((pair, i) => (
              <div
                key={i}
                className="rounded-lg p-3 space-y-2"
                style={{ backgroundColor: "#37353E", border: "1px solid #715A5A20" }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs font-mono mt-2.5 flex-shrink-0" style={{ color: "#D3DAD9", opacity: 0.3 }}>
                    Q{i + 1}
                  </span>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={pair.question}
                      onChange={(e) => updatePair(i, "question", e.target.value)}
                      placeholder="Question..."
                      className="w-full px-3 py-2 rounded-md outline-none text-sm"
                      style={{ backgroundColor: "#2D2B33", color: "#D3DAD9", border: "1px solid #715A5A30" }}
                    />
                    <textarea
                      value={pair.ground_truth}
                      onChange={(e) => updatePair(i, "ground_truth", e.target.value)}
                      placeholder="Expected answer..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-md outline-none text-sm resize-none"
                      style={{ backgroundColor: "#2D2B33", color: "#D3DAD9", border: "1px solid #715A5A30" }}
                    />
                  </div>
                  {qaPairs.length > 1 && (
                    <button
                      onClick={() => removePair(i)}
                      className="mt-2 p-1.5 rounded-md cursor-pointer transition-all hover:brightness-125 flex-shrink-0"
                      style={{ color: "#D3DAD9", opacity: 0.3 }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* JSON format hint */}
          <p className="text-[10px]" style={{ color: "#D3DAD9", opacity: 0.2 }}>
            JSON format: [&#123;&quot;question&quot;: &quot;...&quot;, &quot;ground_truth&quot;: &quot;...&quot;&#125;, ...]
          </p>

          {/* Run Button */}
          <button
            onClick={handleStart}
            disabled={starting || validPairs.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer hover:brightness-110 w-full justify-center"
            style={{
              backgroundColor: "#715A5A",
              color: "#D3DAD9",
              opacity: starting || validPairs.length === 0 ? 0.4 : 1,
            }}
          >
            {starting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {starting ? "Starting..." : `Run Evaluation (${validPairs.length} questions)`}
          </button>
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
              This may take a few minutes depending on the number of questions
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
    </div>
  );
}