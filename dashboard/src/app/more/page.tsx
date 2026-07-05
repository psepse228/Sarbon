import Link from "next/link";

import { BuildingIcon, ChevronRightIcon, TagIcon } from "@/components/icons";

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
      <p className="muted">Каталог и данные компании.</p>

      <p className="hub-group-title">Клиентское предложение</p>
      <div className="card hub-card">
        <LinkRow href="/catalog" label="Каталог" Icon={TagIcon} />
      </div>

      <p className="hub-group-title">Компания</p>
      <div className="card hub-card">
        <LinkRow href="/company-profile" label="Профиль компании" Icon={BuildingIcon} />
      </div>

      <p className="powered-by">Cortège · powered by Solura</p>
    </div>
  );
}
