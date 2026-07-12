"use client";

import { useState } from "react";

import { AvailabilityManager } from "@/components/AvailabilityManager";
import { CompanyInfoEditor } from "@/components/CompanyInfoEditor";
import { FaqEditor } from "@/components/FaqEditor";
import { KnowledgeGapsEditor } from "@/components/KnowledgeGapsEditor";
import { PackagesEditor } from "@/components/PackagesEditor";
import { PartnersEditor } from "@/components/PartnersEditor";
import { PoliciesEditor } from "@/components/PoliciesEditor";
import { SkillsEditor } from "@/components/SkillsEditor";

type ConfigTab =
  | "info"
  | "packages"
  | "faq"
  | "gaps"
  | "partners"
  | "skills"
  | "policies"
  | "availability";

const TABS: { key: ConfigTab; label: string }[] = [
  { key: "info", label: "О заведении" },
  { key: "packages", label: "Пакеты" },
  { key: "faq", label: "Вопросы" },
  { key: "gaps", label: "Пробелы" },
  { key: "partners", label: "Партнёры" },
  { key: "skills", label: "Навыки" },
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
      {tab === "gaps" && <KnowledgeGapsEditor />}
      {tab === "partners" && <PartnersEditor />}
      {tab === "skills" && <SkillsEditor />}
      {tab === "policies" && <PoliciesEditor />}
      {tab === "availability" && <AvailabilityManager />}
    </div>
  );
}
