import { useState } from "react";
import { submitDeviceDecision } from "./deviceApi.ts";

const errorMessages = {
  "invalid-code": "请输入形如 ABCD-1234 的用户码。",
  unavailable: "无法确认提交结果，请稍后重试。",
  forbidden: "当前页面无法提交授权请求。",
  "not-found": "申请不存在或已过期，请重新运行 rabi login。",
  "already-decided": "这份申请已有决定。",
};

type Props = {
  userCode: string;
  onUserCodeChange: (code: string) => void;
  onSignedOut: () => void;
};

export function DeviceDecisionForm({
  userCode,
  onUserCodeChange,
  onSignedOut,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    text: string;
    recorded: boolean;
  } | null>(null);

  const canDecide =
    !submitting && !feedback?.recorded && userCode.trim() !== "";

  async function decide(action: "approve" | "deny") {
    if (!canDecide) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      const result = await submitDeviceDecision(action, userCode);
      if (result === "signed-out") {
        onSignedOut();
        return;
      }

      if (result === "recorded") {
        setFeedback({
          text: action === "approve" ? "已批准设备授权。" : "已拒绝设备授权。",
          recorded: true,
        });
        return;
      }

      setFeedback({ text: errorMessages[result], recorded: false });
    } catch {
      setFeedback({ text: errorMessages.unavailable, recorded: false });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <fieldset disabled={submitting}>
      <legend>确认设备授权</legend>
      <label>
        用户码
        <input
          value={userCode}
          onChange={(event) => {
            onUserCodeChange(event.currentTarget.value);
            setFeedback(null);
          }}
          autoComplete="off"
        />
      </label>
      <button
        type="button"
        disabled={!canDecide}
        onClick={() => void decide("approve")}
      >
        批准
      </button>
      <button
        type="button"
        disabled={!canDecide}
        onClick={() => void decide("deny")}
      >
        拒绝
      </button>
      {submitting && <p role="status">正在提交…</p>}
      {feedback && (
        <p role={feedback.recorded ? "status" : "alert"}>{feedback.text}</p>
      )}
    </fieldset>
  );
}
