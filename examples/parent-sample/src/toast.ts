/**
 * Snackbar/toast notifier for the parent-sample app. Renders short-lived
 * messages into a fixed container so user actions get visible feedback
 * without scrolling the log. Pure DOM glue — no business logic.
 */

export type ToastVariant = 'info' | 'success' | 'error' | 'progress';

export interface ToastHandle {
  /** Re-render the same toast node with a final variant/message and start auto-dismiss. */
  settle(message: string, variant: ToastVariant): void;
  dismiss(): void;
}

export interface Toaster {
  show(message: string, variant?: ToastVariant): ToastHandle;
}

const AUTO_DISMISS_MS: Record<ToastVariant, number | null> = {
  info: 4000,
  success: 4000,
  error: 6000,
  progress: null,
};

export function createToaster(container: HTMLElement): Toaster {
  return {
    show(message: string, variant: ToastVariant = 'info'): ToastHandle {
      const toast = document.createElement('div');
      const spinner = document.createElement('span');
      spinner.className = 'toast__spinner';
      spinner.setAttribute('aria-hidden', 'true');

      const messageEl = document.createElement('span');
      messageEl.className = 'toast__message';
      messageEl.textContent = message;

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'toast__close';
      closeBtn.setAttribute('aria-label', 'Dismiss');
      closeBtn.textContent = '×';

      toast.appendChild(spinner);
      toast.appendChild(messageEl);
      toast.appendChild(closeBtn);
      container.appendChild(toast);

      let dismissed = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      function applyVariant(v: ToastVariant): void {
        toast.className = `toast toast--${v}`;
        toast.setAttribute('role', v === 'error' ? 'alert' : 'status');
      }

      function startAutoDismiss(v: ToastVariant): void {
        const ms = AUTO_DISMISS_MS[v];
        if (ms === null) return;
        timer = setTimeout(dismiss, ms);
      }

      function clearTimer(): void {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      }

      function dismiss(): void {
        if (dismissed) return;
        dismissed = true;
        clearTimer();
        toast.classList.add('toast--leaving');
        // Removal time matches the CSS exit animation duration.
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 200);
      }

      closeBtn.addEventListener('click', dismiss);

      applyVariant(variant);
      startAutoDismiss(variant);

      return {
        settle(nextMessage, nextVariant) {
          if (dismissed) return;
          clearTimer();
          applyVariant(nextVariant);
          messageEl.textContent = nextMessage;
          startAutoDismiss(nextVariant);
        },
        dismiss,
      };
    },
  };
}
