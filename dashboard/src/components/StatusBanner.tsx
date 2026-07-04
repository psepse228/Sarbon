"use client";

export function ErrorBanner({ message }: { message: string }) {
  return <div className="status-banner error">Ошибка: {message}</div>;
}

export function SuccessBanner({ message }: { message: string }) {
  return <div className="status-banner success">{message}</div>;
}

/** Shown whenever the app isn't running inside the Telegram webview (local dev). */
export function DevModeBanner() {
  return (
    <div className="status-banner dev">
      Режим разработки: приложение открыто вне Telegram. Запросы к API проходят
      только если на сервере задан <code>DEV_BYPASS_INIT_DATA</code>.
    </div>
  );
}
