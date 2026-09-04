"use client";

import { useState, useRef } from "react";

/**
 * Collectra — หน้าตรวจสอบของแท้/ปลอมของ photo card
 */

type Observation = { type: "positive" | "concern"; text: string };

type Provider = "claude" | "openai" | "gemini";

const PROVIDER_ENDPOINT: Record<Provider, string> = {
  claude: "/app/api/check-card",
  openai: "/app/api/check-card-openai",
  gemini: "/app/api/check-card-gemini",
};

const PROVIDER_LABEL: Record<Provider, string> = {
  claude: "Claude (Anthropic)",
  openai: "GPT-4o (OpenAI)",
  gemini: "Gemini (Google)",
};

type VerifyResult = {
  confidence_score: number;
  verdict: "Likely Authentic" | "Suspicious" | "Needs Manual Review";
  verdict_th: string;
  summary: string;
  observations: Observation[];
  disclaimer: string;
};

const VERDICT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  "Likely Authentic": { label: "Likely Authentic", color: "#166534", bg: "#dcfce7" },
  "Needs Manual Review": { label: "Needs Manual Review", color: "#92400e", bg: "#fef3c7" },
  Suspicious: { label: "Suspicious", color: "#991b1b", bg: "#fee2e2" },
};

export default function VerifyPage() {
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>("claude");

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  function handleFrontChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFrontFile(file);
    setFrontPreview(file ? URL.createObjectURL(file) : null);
    setResult(null);
    setError(null);
  }

  function handleBackChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setBackFile(file);
    setBackPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleAuthenticate() {
    if (!frontFile) {
      setError("กรุณาอัปโหลดรูปด้านหน้าของการ์ดก่อนนะครับ");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("front", frontFile);
      if (backFile) formData.append("back", backFile);

      const response = await fetch(PROVIDER_ENDPOINT[provider], {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 502 || response.status === 500) {
          throw new Error("ไม่สามารถเชื่อมต่อกับระบบตรวจสอบได้ ลองใหม่อีกครั้ง");
        }
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      }

      const data: VerifyResult = await response.json();
      setResult(data);
    } catch (err) {
      const message =
        err instanceof TypeError
          ? "ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อ"
          : err instanceof Error
            ? err.message
            : "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const verdictStyle = result ? VERDICT_STYLE[result.verdict] : null;

  return (
    <div className="verifyPage">
      <nav className="verifyNav">
        <a href="/" style={{ textDecoration: "none" }}>
          <span className="verifyLogo" style={{ display: "flex", alignItems: "center" }}>
            <img src="/logo.png" alt="Collectra" style={{ height: 120, width: "auto" }} />
          </span>
        </a>
      </nav>

      <div className="verifyHero">
        <h1>COLLECTRA</h1>
        <p>AI-Powered Photocard Authentication</p>
      </div>

      <div className="verifyCard">
        <div className="verifyUploadGrid">
          <UploadBox
            label="รูปด้านหน้า"
            required
            preview={frontPreview}
            onPick={() => frontInputRef.current?.click()}
            onRemove={() => {
              setFrontFile(null);
              setFrontPreview(null);
            }}
          />
          <input
            ref={frontInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFrontChange}
          />

          <UploadBox
            label="รูปด้านหลัง"
            required={false}
            preview={backPreview}
            onPick={() => backInputRef.current?.click()}
            onRemove={() => {
              setBackFile(null);
              setBackPreview(null);
            }}
          />
          <input
            ref={backInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleBackChange}
          />
        </div>

        <div className="verifyGuide">
          <p className="verifyGuideTitle">📷 คำแนะนำก่อนถ่ายรูป</p>
          <div className="verifyGuideGrid">
            <div>
              <p className="verifyGuideHeading">ด้านหน้า</p>
              <ul>
                <li>เห็นการ์ดทั้งใบ</li>
                <li>ถ่ายมุมตรง</li>
                <li>แสงสว่างเพียงพอ</li>
                <li>พื้นหลังเรียบง่าย</li>
              </ul>
            </div>
            <div>
              <p className="verifyGuideHeading">ด้านหลัง</p>
              <ul>
                <li>เห็นด้านหลังทั้งหมด</li>
                <li>เห็นบาร์โค้ด/โลโก้</li>
                <li>ถ่ายมุมตรง แสงพอเหมาะ</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="verifyProviderRow">
          <label htmlFor="ai-provider" className="verifyProviderLabel">
            เลือก AI ที่จะใช้ตรวจสอบ
          </label>
          <select
            id="ai-provider"
            className="verifyProviderSelect"
            value={provider}
            disabled={loading}
            onChange={(e) => setProvider(e.target.value as Provider)}
          >
            {(Object.keys(PROVIDER_LABEL) as Provider[]).map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABEL[p]}
              </option>
            ))}
          </select>
        </div>

        <button
          className="verifyButton"
          disabled={!frontFile || loading}
          onClick={handleAuthenticate}
        >
          {loading ? "Analyzing…" : `Authenticate Card (${PROVIDER_LABEL[provider]})`}
        </button>

        {loading && (
          <div className="verifyLoading">
            <div className="verifySpinner" />
            <p>AI is analyzing your photocard…</p>
            <ul>
              <li>Print quality</li>
              <li>Color consistency</li>
              <li>Edge cutting</li>
              <li>Surface texture</li>
              <li>Logos</li>
              <li>Overall authenticity</li>
            </ul>
          </div>
        )}

        {error && <div className="verifyError">{error}</div>}

        {result && verdictStyle && (
          <div className="verifyResults">
            <p className="verifyProviderUsed">ตรวจโดย: {PROVIDER_LABEL[provider]}</p>
            <span
              className="verifyBadge"
              style={{ color: verdictStyle.color, background: verdictStyle.bg }}
            >
              {verdictStyle.label}
            </span>

            <ScoreCircle score={result.confidence_score} />

            <div className="verifySummaryCard">
              <p className="verifyCardTitle">Summary</p>
              <p>{result.summary}</p>
            </div>

            <div className="verifyObservations">
              {result.observations.map((obs, i) => (
                <div
                  key={i}
                  className={
                    "verifyObsCard " + (obs.type === "positive" ? "obsPositive" : "obsConcern")
                  }
                >
                  <span>{obs.type === "positive" ? "✅" : "⚠️"}</span>
                  <p>{obs.text}</p>
                </div>
              ))}
            </div>

            <div className="verifyDisclaimer">{result.disclaimer}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadBox({
  label,
  required,
  preview,
  onPick,
  onRemove,
}: {
  label: string;
  required: boolean;
  preview: string | null;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="verifyUploadBox">
      <p className="verifyUploadLabel">
        {label} {required ? <span className="verifyRequired">*</span> : <span className="verifyOptional">(ไม่บังคับ)</span>}
      </p>
      {preview ? (
        <div className="verifyPreviewWrap">
          <img src={preview} alt={label} className="verifyPreviewImg" />
          <button type="button" className="verifyRemoveBtn" onClick={onRemove}>
            ลบรูป / เปลี่ยนรูป
          </button>
        </div>
      ) : (
        <button type="button" className="verifyUploadTrigger" onClick={onPick}>
          <span className="verifyUploadIcon">📤</span>
          <span>แตะเพื่ออัปโหลด</span>
        </button>
      )}
    </div>
  );
}

function ScoreCircle({ score }: { score: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * Math.min(Math.max(score, 0), 100)) / 100;
  const color = score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#dc2626";

  return (
    <div className="verifyScoreWrap">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="#eef4ff" strokeWidth="10" />
        <circle
          cx="55"
          cy="55"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 55 55)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text x="55" y="55" textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="900" fill="#26314A">
          {score}%
        </text>
      </svg>
      <p className="verifyScoreLabel">Confidence Score</p>
    </div>
  );
}