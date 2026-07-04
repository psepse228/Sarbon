import Link from "next/link";

import { ChatIcon, ChevronRightIcon, DocumentIcon, QuestionIcon, TagIcon, UsersIcon } from "@/components/icons";

const VENUE_LINKS = [
  { href: "/packages", label: "Пакеты и цены", Icon: TagIcon },
  { href: "/faq", label: "Частые вопросы", Icon: QuestionIcon },
  { href: "/partners", label: "Партнёры", Icon: UsersIcon },
  { href: "/policies", label: "Политики", Icon: DocumentIcon },
];

const ACTIVITY_LINKS = [{ href: "/conversations", label: "Диалоги с клиентами", Icon: ChatIcon }];

function LinkRow({ href, label, Icon }: { href: string; label: string; Icon: typeof TagIcon }) {
  return (
    <Link href={href} className="hub-row">
      <span className="hub-row-icon">
        <Icon />
      </span>
      <span className="hub-row-label">{label}</span>
      <ChevronRightIcon className="hub-row-chevron" />
    </Link>
  );
}

export default function MorePage() {
  return (
    <div>
      <h1>Ещё</h1>
      <p className="muted">Данные заведения и активность клиентов.</p>

      <p className="hub-group-title">Данные заведения</p>
      <div className="card hub-card">
        {VENUE_LINKS.map((link) => (
          <LinkRow key={link.href} {...link} />
        ))}
      </div>

      <p className="hub-group-title">Активность</p>
      <div className="card hub-card">
        {ACTIVITY_LINKS.map((link) => (
          <LinkRow key={link.href} {...link} />
        ))}
      </div>

      <p className="powered-by">Cortège · powered by Solura</p>
    </div>
  );
}
