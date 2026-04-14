import type { CSSProperties, ReactElement } from 'react';
import { useEffect, useRef } from 'react';
import { tRenderer } from './i18n';

export type AppFeedbackTone = 'error' | 'success';

export interface AppFeedback {
  tone: AppFeedbackTone;
  message: string;
}

const APP_FEEDBACK_AUTO_DISMISS_MS = 5000;

interface AppFeedbackBannerProps extends AppFeedback {
  onDismiss: () => void;
}

export function AppFeedbackBanner({
  tone,
  message,
  onDismiss,
}: AppFeedbackBannerProps): ReactElement {
  const onDismissRef = useRef(onDismiss);
  const progressStyle = {
    '--app-feedback-duration-ms': `${APP_FEEDBACK_AUTO_DISMISS_MS}ms`,
  } as CSSProperties;

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onDismissRef.current();
    }, APP_FEEDBACK_AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message, tone]);

  return (
    <div
      className={`app-feedback-banner app-feedback-banner-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      style={progressStyle}
    >
      <div className="app-feedback-banner-main">
        <p className="app-feedback-banner-copy">{message}</p>
        <button
          className="app-feedback-banner-dismiss"
          onClick={onDismiss}
          aria-label={tRenderer('app.feedback.dismiss')}
        >
          ×
        </button>
      </div>

      <div className="app-feedback-banner-track" aria-hidden="true">
        <div key={`${tone}:${message}`} className="app-feedback-banner-progress" />
      </div>
    </div>
  );
}
