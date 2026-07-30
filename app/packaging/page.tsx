"use client";

import { useState, useRef } from "react";

/**
 * Collectra — หน้าตรวจสอบแพ็ค/แกะกล่อง (packing vs unboxing)
 * ธีมและโครงสร้างเดียวกับหน้า /verify แต่รับรูป 2 ฝั่ง (ผู้ขาย/ผู้ซื้อ)
 */

type Observation = { type: "positive" | "concern"; text: string };

type PackingResult = {
  match_verdict: "Match" | "Mismatch" | "Needs Manual Review";
  match_verdict_th: string;
  confidence_score: number;
  sleeve_detected: boolean;
  summary: string;
  observations: Observation[];
  disclaimer: string;
};

const VERDICT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  Match: { label: "Match", color: "#166534", bg: "#dcfce7" },
  "Needs Manual Review": { label: "Needs Manual Review", color: "#92400e", bg: "#fef3c7" },
  Mismatch: { label: "Mismatch", color: "#991b1b", bg: "#fee2e2" },
};

export default function PackagingPage() {
  const [packingFile, setPackingFile] = useState<File | null>(null);
  const [unboxingFile, setUnboxingFile] = useState<File | null>(null);
  const [packingPreview, setPackingPreview] = useState<string | null>(null);
  const [unboxingPreview, setUnboxingPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const packingInputRef = useRef<HTMLInputElement>(null);
  const unboxingInputRef = useRef<HTMLInputElement>(null);

  function handlePackingChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPackingFile(file);
    setPackingPreview(file ? URL.createObjectURL(file) : null);
    setResult(null);
    setError(null);
  }

  function handleUnboxingChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setUnboxingFile(file);
    setUnboxingPreview(file ? URL.createObjectURL(file) : null);
    setResult(null);
    setError(null);
  }

  async function handleCheck() {
    if (!packingFile || !unboxingFile) {
      setError("กรุณาอัปโหลดรูปทั้งสองฝั่งก่อนครับ (แพ็ค + แกะกล่อง)");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("packing", packingFile);
      formData.append("unboxing", unboxingFile);

      const response = await fetch("/app/api/check-packing", {
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

      const data: PackingResult = await response.json();
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

  const verdictStyle = result ? VERDICT_STYLE[result.match_verdict] : null;

  return (
    <div className="verifyPage">
      <nav className="verifyNav">
        <span className="verifyLogo" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 40 40">
            <defs>
              <linearGradient id="collectraGrad3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B6FD4" />
                <stop offset="100%" stopColor="#E0B84B" />
              </linearGradient>
            </defs>
            <path
              d="M20,2 C22,14 26,18 38,20 C26,22 22,26 20,38 C18,26 14,22 2,20 C14,18 18,14 20,2 Z"
              fill="url(#collectraGrad3)"
            />
          </svg>
          COLLECTRA
        </span>
      </nav>

      <div className="verifyHero">
        <h1>PACKAGING CHECK</h1>
        <p>เปรียบเทียบรูปตอนแพ็คสินค้า กับรูปตอนแกะกล่อง เพื่อลดข้อพิพาทการ์ดสลับ</p>
      </div>

      <div className="verifyCard">
        <div className="verifyUploadGrid">
          <UploadBox
            label="รูปตอนแพ็ค (ผู้ขาย)"
            required
            preview={packingPreview}
            onPick={() => packingInputRef.current?.click()}
            onRemove={() => {
              setPackingFile(null);
              setPackingPreview(null);
            }}
          />
          <input
            ref={packingInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handlePackingChange}
          />

          <UploadBox
            label="รูปตอนแกะกล่อง (ผู้ซื้อ)"
            required
            preview={unboxingPreview}
            onPick={() => unboxingInputRef.current?.click()}
            onRemove={() => {
              setUnboxingFile(null);
              setUnboxingPreview(null);
            }}
          />
          <input
            ref={unboxingInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleUnboxingChange}
          />
        </div>

        <div className="verifyGuide">
          <p className="verifyGuideTitle">📷 คำแนะนำก่อนถ่ายรูป</p>
          <div className="verifyGuideGrid">
            <div>
              <p className="verifyGuideHeading">ตอนแพ็ค</p>
              <ul>
                <li>เห็นหน้าการ์ดชัดก่อนห่อ</li>
                <li>เห็นซอง/ท็อปโหลดเดอร์ที่ใส่</li>
                <li>แสงสว่างเพียงพอ</li>
              </ul>
            </div>
            <div>
              <p className="verifyGuideHeading">ตอนแกะกล่อง</p>
              <ul>
                <li>เห็นการ์ดที่ได้รับชัดเจน</li>
                <li>ถ่ายก่อนแกะซอง/ท็อปโหลดเดอร์</li>
                <li>มุมและแสงใกล้เคียงรูปแพ็ค</li>
              </ul>
            </div>
          </div>
        </div>

        <button
          className="verifyButton"
          disabled={!packingFile || !unboxingFile || loading}
          onClick={handleCheck}
        >
          {loading ? "Analyzing…" : "Check Packaging"}
        </button>

        {loading && (
          <div className="verifyLoading">
            <div className="verifySpinner" />
            <p>AI is comparing your photos…</p>
            <ul>
              <li>Card match</li>
              <li>Sleeve detection</li>
              <li>Tampering signs</li>
            </ul>
          </div>
        )}

        {error && <div className="verifyError">{error}</div>}

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
              <p style={{ marginTop: 8, fontWeight: 700 }}>
                ซอง/ท็อปโหลดเดอร์: {result.sleeve_detected ? "พบ ✅" : "ไม่พบ ⚠️"}
              </p>
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
        {label} {required ? <span className="verifyRequired">*</span> : null}
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
