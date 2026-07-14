const ERROR_MESSAGES: Record<string, string> = {
  state: "Сессия входа истекла или недействительна. Попробуйте снова.",
  token: "Не удалось подтвердить вход через Google. Попробуйте снова.",
  userinfo: "Не удалось получить данные аккаунта Google. Попробуйте снова.",
  unverified: "Email в вашем Google-аккаунте не подтверждён.",
  tenant: "Не удалось найти или создать рабочее пространство. Попробуйте снова.",
  config: "Вход через Google временно недоступен. Попробуйте позже.",
  oauth: "Не удалось войти через Google. Попробуйте снова.",
};

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] ?? ERROR_MESSAGES.oauth : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "5rem", gap: "0.75rem" }}>
      <h1>Вход в Cortège</h1>
      <p className="muted" style={{ textAlign: "center", maxWidth: 320 }}>
        Войдите через Google, чтобы открыть панель владельца. Если вы входите впервые, для вас автоматически
        создастся новое рабочее пространство.
      </p>
      {errorMessage && <p style={{ color: "var(--color-danger)" }}>{errorMessage}</p>}
      <a href="/api/auth/google/start" className="btn btn-primary" style={{ marginTop: "1.5rem" }}>
        Войти через Google
      </a>
    </div>
  );
}
