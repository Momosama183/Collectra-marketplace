"use client";

import { useState, useRef } from "react";

/**
 * ALL IN Verify — หน้าตรวจสอบของแท้/ปลอมของ photo card
 *
 * ตามสเปค UI/UX ที่ทีมส่งมา:
 * - ธีมกรมท่าเข้ม + การ์ดขาว + ปุ่มใหญ่ ให้ความรู้สึกน่าเชื่อถือ
 * - อัปโหลดรูปหน้า (จำเป็น) + หลัง (ไม่บังคับ)
 * - คำแนะนำการถ่ายรูปก่อนอัปโหลด
 * - ปุ่ม Authenticate Card -> เรียก /app/api/check-card
 * - หน้าผลลัพธ์: badge สี, คะแนนวงกลม, สรุป, observations, disclaimer
 */

type Observation = { type: "positive" | "concern"; text: string };

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

      const response = await fetch("/app/api/check-card", {
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
        <span className="verifyLogo" style={{ display: "flex", alignItems: "center", gap: 8 }}>
  <svg width="20" height="20" viewBox="0 0 40 40">
    <defs>
      <linearGradient id="collectraGrad2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3B6FD4" />
        <stop offset="100%" stopColor="#E0B84B" />
      </linearGradient>
    </defs>
    <path
      d="M20,2 C22,14 26,18 38,20 C26,22 22,26 20,38 C18,26 14,22 2,20 C14,18 18,14 20,2 Z"
      fill="url(#collectraGrad2)"
    />
  </svg>
  COLLECTRA
</span>
      </nav>

      <div className="verifyHero">
        <h1>COLLECTRA</h1>
        <p>AI-Powered Photocard Authentication</p>
      </div>

      <div className="verifyCard">
        {/* Upload section */}
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

        {/* Photography guide */}
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

        {/* Authenticate button */}
        <button
          className="verifyButton"
          disabled={!frontFile || loading}
          onClick={handleAuthenticate}
        >
          {loading ? "Analyzing…" : "Authenticate Card"}
        </button>

        {/* Loading state */}
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

        {/* Error */}
        {error && <div className="verifyError">{error}</div>}

        {/* Results */}
        {result && verdictStyle && (
          <div className="verifyResults">
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
        <text x="55" y="55" textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="900" fill="#061733">
          {score}%
        </text>
      </svg>
      <p className="verifyScoreLabel">Confidence Score</p>
    </div>
  );
}
