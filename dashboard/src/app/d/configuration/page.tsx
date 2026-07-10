"use client";

import { useState } from "react";

import { AvailabilityManager } from "@/components/AvailabilityManager";
import { CompanyInfoEditor } from "@/components/CompanyInfoEditor";
import { FaqEditor } from "@/components/FaqEditor";
import { PackagesEditor } from "@/components/PackagesEditor";
import { PartnersEditor } from "@/components/PartnersEditor";
import { PoliciesEditor } from "@/components/PoliciesEditor";

type ConfigTab = "info" | "packages" | "faq" | "partners" | "policies" | "availability";

const TABS: { key: ConfigTab; label: string }[] = [
  { key: "info", label: "О заведении" },
  { key: "packages", label: "Пакеты" },
  { key: "faq", label: "Вопросы" },
  { key: "partners", label: "Партнёры" },
  { key: "policies", label: "Политики" },
  { key: "availability", label: "Календарь" },
];

export default function DesktopConfigurationPage() {
  const [tab, setTab] = useState<ConfigTab>("info");

  return (
    <div>
      <h1>Настройки</h1>
      <p className="muted">Данные, которые бот использует, отвечая клиентам.</p>

      <div className="segmented" style={{ marginBottom: "1.4rem", flexWrap: "wrap" }}>
        {TABS.map(({ key, label }) => (
          <button key={key} data-active={tab === key} onClick={() => setTab(key)} type="button">
            {label}
          </button>
        ))}
      </div>

      {tab === "info" && <CompanyInfoEditor />}
      {tab === "packages" && <PackagesEditor />}
      {tab === "faq" && <FaqEditor />}
      {tab === "partners" && <PartnersEditor />}
      {tab === "policies" && <PoliciesEditor />}
      {tab === "availability" && <AvailabilityManager />}
    </div>
  );
}
