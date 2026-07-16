"use client";

import { useEffect, useState } from "react";

import {
  ChatIcon,
  InstagramIcon,
  MailIcon,
  MessengerIcon,
  TelegramIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { tmaFetch } from "@/lib/telegram/client";

interface ConnectorCardProps {
  Icon: typeof TelegramIcon;
  name: string;
  description: string;
  status: "connected" | "not-configured" | "coming-soon";
}

const STATUS_LABEL: Record<ConnectorCardProps["status"], string> = {
  connected: "Подключено",
  "not-configured": "Не настроено",
  "coming-soon": "Скоро",
};

function ConnectorCard({ Icon, name, description, status }: ConnectorCardProps) {
  return (
    <div className="card connector-card">
      <div className="connector-card-icon">
        <Icon />
      </div>
      <div className="connector-card-body">
        <div className="card-title-row">
          <strong>{name}</strong>
          <span className="connector-status" data-status={status}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        <p className="muted">{description}</p>
      </div>
    </div>
  );
}

export default function ConnectorsPage() {
  const [telegramConnected, setTelegramConnected] = useState<boolean | null>(null);

  useEffect(() => {
    tmaFetch("/api/connectors/status")
      .then(async (res) => (res.ok ? ((await res.json()) as { telegramConnected: boolean }) : null))
      .then((body) => setTelegramConnected(body?.telegramConnected ?? false))
      .catch(() => setTelegramConnected(false));
  }, []);

  return (
    <div>
      <h1>Коннекторы</h1>
      <p className="muted">Каналы, через которые бот получает и отправляет сообщения клиентам.</p>

      <div className="connector-grid">
        <ConnectorCard
          Icon={TelegramIcon}
          name="Telegram"
          description="Основной канал бота — клиенты пишут напрямую в Telegram."
          status={telegramConnected === null ? "not-configured" : telegramConnected ? "connected" : "not-configured"}
        />
        <ConnectorCard
          Icon={InstagramIcon}
          name="Instagram"
          description="Direct-сообщения из Instagram — в разработке."
          status="coming-soon"
        />
        <ConnectorCard
          Icon={WhatsAppIcon}
          name="WhatsApp"
          description="WhatsApp Business API — в разработке."
          status="coming-soon"
        />
        <ConnectorCard
          Icon={MessengerIcon}
          name="Facebook Messenger"
          description="Сообщения со страницы Facebook — в разработке."
          status="coming-soon"
        />
        <ConnectorCard
          Icon={ChatIcon}
          name="Веб-чат"
          description="Виджет чата на сайте заведения — в разработке."
          status="coming-soon"
        />
        <ConnectorCard
          Icon={MailIcon}
          name="Email"
          description="Обращения по электронной почте — в разработке."
          status="coming-soon"
        />
      </div>
    </div>
  );
}
