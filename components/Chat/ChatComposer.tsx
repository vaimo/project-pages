"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ChatComposerProps {
  disabled: boolean;
  placeholder: string;
  onSend: (text: string) => void;
  maxChars: number;
}

const MAX_HEIGHT_PX = 200;
/** Show the counter only when the user gets close to the limit. */
const COUNTER_THRESHOLD = 0.8;

export default function ChatComposer({
  disabled,
  placeholder,
  onSend,
  maxChars,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  const overLimit = value.length > maxChars;
  const showCounter = value.length >= Math.floor(maxChars * COUNTER_THRESHOLD);
  const canSend = !disabled && !overLimit && value.trim().length > 0;

  const submit = useCallback(() => {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
    requestAnimationFrame(() => {
      if (ref.current) ref.current.style.height = "auto";
    });
  }, [canSend, onSend, value]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const counterColor = overLimit
    ? "#a23434"
    : value.length > maxChars * 0.95
    ? "#a23434"
    : "var(--color-grey-500)";

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          border: `1px solid ${overLimit ? "#a23434" : "var(--color-grey-300)"}`,
          borderRadius: "8px",
          background: "var(--color-white)",
          padding: "0.5rem 0.6rem",
        }}
      >
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, maxChars + 200))}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          aria-invalid={overLimit}
          style={{
            flex: 1,
            resize: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "0.9375rem",
            lineHeight: 1.5,
            color: "var(--color-grey-900)",
            fontFamily: "inherit",
            maxHeight: `${MAX_HEIGHT_PX}px`,
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label="Send message"
          style={{
            background: !canSend ? "var(--color-grey-300)" : "var(--color-yellow)",
            color: "var(--color-grey-900)",
            border: "none",
            borderRadius: "6px",
            padding: "0.4rem 0.85rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: !canSend ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Send
        </button>
      </div>
      {showCounter && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "0.25rem",
            fontSize: "0.7rem",
            color: counterColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value.length.toLocaleString()} / {maxChars.toLocaleString()}
          {overLimit && " — too long"}
        </div>
      )}
    </div>
  );
}
