/**
 * Layer: Frontend Component
 * Responsibility: Renders the visual showcase panel reused by auth screens.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import React from 'react';
import { Sparkles, Sprout, TrendingUp } from 'lucide-react';

interface AuthShowcaseProps {
  eyebrow: string;
  title: string;
  description: string;
  highlights: Array<{ label: string; value: string }>;
}

export default function AuthShowcase({
  eyebrow,
  title,
  description,
  highlights,
}: AuthShowcaseProps) {
  return (
    <div className="auth-showcase">
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="mini-badge">
            <Sparkles size={14} />
            {eyebrow}
          </div>
          <h1 className="page-title max-w-xl">{title}</h1>
          <p className="page-subtitle">{description}</p>
        </div>

        <div className="my-10 phone-stack">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="phone-tile"
              style={{
                transform: item % 2 === 0 ? 'translateY(-10px)' : 'translateY(10px)',
              }}
            >
              <div className="phone-screen">
                <div className="phone-bar" />
                <div className="phone-chip" />
                <div className="phone-line" style={{ width: `${78 - item * 6}%` }} />
                <div className="phone-line" style={{ width: `${64 - (item % 3) * 10}%` }} />
                <div className="phone-grid">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="list-rows">
          {highlights.map((item, index) => (
            <div key={item.label} className="list-row">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#28586f] text-[#d7f7eb]">
                  {index === 0 ? <Sprout size={18} /> : <TrendingUp size={18} />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">{item.label}</p>
                  <p className="text-xs text-[var(--muted)]">轻量排版与浅绿浅蓝层次统一呈现</p>
                </div>
              </div>
              <p className="text-lg font-extrabold tracking-tight text-[var(--ink)]">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
