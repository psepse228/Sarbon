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
import { useT } from "@/lib/i18n/LocaleProvider";
import { tmaFetch } from "@/lib/telegram/client";

interface ConnectorCardProps {
  Icon: typeof TelegramIcon;
  name: string;
  description: string;
  status: "connected" | "not-configured" | "coming-soon";
  statusLabel: string;
}

function ConnectorCard({ Icon, name, description, status, statusLabel }: ConnectorCardProps) {
  return (
    <div className="card connector-card">
      <div className="connector-card-icon">
        <Icon />
      </div>
      <div className="connector-card-body">
        <div className="card-title-row">
          <strong>{name}</strong>
          <span className="connector-status" data-status={status}>
            {statusLabel}
          </span>
        </div>
        <p className="muted">{description}</p>
      </div>
    </div>
  );
}

export default function ConnectorsPage() {
  const t = useT();
  const [telegramConnected, setTelegramConnected] = useState<boolean | null>(null);

  useEffect(() => {
    tmaFetch("/api/connectors/status")
      .then(async (res) => (res.ok ? ((await res.json()) as { telegramConnected: boolean }) : null))
      .then((body) => setTelegramConnected(body?.telegramConnected ?? false))
      .catch(() => setTelegramConnected(false));
  }, []);

  const telegramStatus = telegramConnected ? "connected" : "not-configured";

  return (
    <div>
      <h1>{t("connectors.title")}</h1>
      <p className="muted">{t("connectors.subtitle")}</p>

      <div className="connector-grid">
        <ConnectorCard
          Icon={TelegramIcon}
          name="Telegram"
          description={t("connectors.telegramDesc")}
          status={telegramStatus}
          statusLabel={telegramStatus === "connected" ? t("connectors.connected") : t("connectors.notConfigured")}
        />
        <ConnectorCard
          Icon={InstagramIcon}
          name="Instagram"
          description={t("connectors.instagramDesc")}
          status="coming-soon"
          statusLabel={t("connectors.comingSoon")}
        />
        <ConnectorCard
          Icon={WhatsAppIcon}
          name="WhatsApp"
          description={t("connectors.whatsappDesc")}
          status="coming-soon"
          statusLabel={t("connectors.comingSoon")}
        />
        <ConnectorCard
          Icon={MessengerIcon}
          name="Facebook Messenger"
          description={t("connectors.messengerDesc")}
          status="coming-soon"
          statusLabel={t("connectors.comingSoon")}
        />
        <ConnectorCard
          Icon={ChatIcon}
          name={t("connectors.webchatName")}
          description={t("connectors.webchatDesc")}
          status="coming-soon"
          statusLabel={t("connectors.comingSoon")}
        />
        <ConnectorCard
          Icon={MailIcon}
          name="Email"
          description={t("connectors.emailDesc")}
          status="coming-soon"
          statusLabel={t("connectors.comingSoon")}
        />
      </div>
    </div>
  );
}
