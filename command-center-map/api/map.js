const path = require("path");

const NOTION_VERSION = "2025-09-03";
const FONT_DISPLAY = "Syne";
const FONT_BODY = "DM Sans";
const FONT_MONO = "JetBrains Mono";

const DATA_SOURCES = {
  products: "39616c60-57da-80ea-95b6-000b95dd95c9",
  subscriptions: "39616c60-57da-803e-a5c0-000b932e105a",
  legal: "39616c60-57da-803b-bfa7-000b8476a816",
};

const COLORS = {
  bg: "#080c12",
  dot: "#1b2531",
  hubFill: "#131b28",
  hubStroke: "#324258",
  cardFill: "#0e141e",
  cardStroke: "#233042",
  connector: "#2a3644",
  text: "#eaf1f8",
  textSecondary: "#a9b7c9",
  textMuted: "#647184",
  good: "#34d399",
  warning: "#fbbf24",
  critical: "#fb7185",
  cyan: "#38bdf8",
};

async function queryDataSource(dataSourceId) {
  const res = await fetch(
    `https://api.notion.com/v1/data_sources/${dataSourceId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100 }),
    }
  );
  if (!res.ok) {
    throw new Error(`Notion query failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.results;
}

function plainText(richTextArray) {
  return (richTextArray || []).map((t) => t.plain_text).join("");
}

function title(page) {
  return plainText(page.properties?.Name?.title);
}

function selectName(page, prop) {
  return page.properties?.[prop]?.select?.name || "";
}

function num(page, prop) {
  return page.properties?.[prop]?.number ?? null;
}

function dateStart(page, prop) {
  return page.properties?.[prop]?.date?.start || null;
}

function escapeXml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  }[c]));
}

function daysUntil(dateStr, now) {
  const target = new Date(dateStr + "T00:00:00Z");
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function statusColor(status) {
  if (status === "On track") return { color: COLORS.good, label: "On track" };
  if (status === "At risk") return { color: COLORS.warning, label: "At risk" };
  if (status === "Blocked") return { color: COLORS.critical, label: "Blocked" };
  return { color: COLORS.textMuted, label: status || "Unknown" };
}

function renderMap({ products, subscriptions, legal }, now) {
  const width = 1000;
  const height = Math.max(640, 90 + products.length * 128 + 40);

  const activeCount = products.filter((p) => selectName(p, "Stage") !== "Shelved").length;
  const shelvedCount = products.length - activeCount;
  const productsCaption = shelvedCount === 0
    ? "all active"
    : `${activeCount} active &#183; ${shelvedCount} shelved`;

  const paidSubs = subscriptions.filter((s) => selectName(s, "Status") === "Active-paid");
  const totalMonthly = paidSubs.reduce((sum, s) => {
    const cost = num(s, "Cost") || 0;
    const monthlyCost = selectName(s, "Cadence") === "Annual" ? cost / 12 : cost;
    return sum + monthlyCost;
  }, 0);

  const legalWithDates = legal
    .filter((l) => dateStart(l, "Due Date") && selectName(l, "Status") !== "Done")
    .map((l) => ({ page: l, days: daysUntil(dateStart(l, "Due Date"), now) }))
    .sort((a, b) => a.days - b.days);
  const urgentLegal = legalWithDates.filter((l) => l.days <= 14).slice(0, 3);

  const hubX = 45, hubY = 265, hubW = 170, hubH = 110;
  const hubCX = hubX + hubW, hubCY = hubY + hubH / 2;

  const branchX = 365, branchW = 190, branchH = 90;
  const branchProductsY = 45;
  const branchSubsY = height / 2 - branchH / 2;
  const branchLegalY = height - 135;
  const branchProductsCX = branchX, branchProductsCY = branchProductsY + branchH / 2;
  const branchSubsCY = branchSubsY + branchH / 2;
  const branchLegalCY = branchLegalY + branchH / 2;

  const leafX = 700, leafW = 260;
  const rowH = (height - 20) / Math.max(products.length, 1);
  const leafH = Math.min(100, rowH * 0.78);

  let svg = "";
  svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
  svg += `<defs><pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${COLORS.dot}" /></pattern></defs>`;
  svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="${COLORS.bg}" />`;
  svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#dots)" />`;

  // connectors: hub -> branches
  svg += `<g fill="none" stroke="${COLORS.connector}" stroke-width="1.5">`;
  svg += `<path d="M${hubCX},${hubCY} C${hubCX + 75},${hubCY} ${hubCX + 75},${branchProductsCY} ${branchX},${branchProductsCY}" />`;
  svg += `<path d="M${hubCX},${hubCY} L${branchX},${branchSubsCY}" />`;
  svg += `<path d="M${hubCX},${hubCY} C${hubCX + 75},${hubCY} ${hubCX + 75},${branchLegalCY} ${branchX},${branchLegalCY}" />`;
  // connectors: products branch -> leaves
  const branchProductsRightX = branchX + branchW;
  for (let i = 0; i < products.length; i++) {
    const leafCY = 10 + i * rowH + leafH / 2;
    svg += `<path d="M${branchProductsRightX},${branchProductsCY} C${branchProductsRightX + 65},${branchProductsCY} ${branchProductsRightX + 65},${leafCY} ${leafX},${leafCY}" />`;
  }
  svg += `</g>`;

  // hub
  svg += `<rect x="${hubX}" y="${hubY}" width="${hubW}" height="${hubH}" rx="7" fill="${COLORS.hubFill}" stroke="${COLORS.hubStroke}" stroke-width="1.2" />`;
  svg += `<text x="${hubX + hubW / 2}" y="${hubY + hubH / 2 - 3}" text-anchor="middle" font-family="${FONT_DISPLAY}" font-weight="800" font-size="26" letter-spacing="1" fill="${COLORS.text}">SOLURA</text>`;
  svg += `<text x="${hubX + hubW / 2}" y="${hubY + hubH / 2 + 20}" text-anchor="middle" font-family="${FONT_BODY}" font-size="11" fill="${COLORS.textMuted}">AI systems for growing businesses</text>`;

  // branch: products
  svg += `<rect x="${branchX}" y="${branchProductsY}" width="${branchW}" height="${branchH}" rx="7" fill="${COLORS.cardFill}" stroke="${COLORS.cardStroke}" stroke-width="1.2" />`;
  svg += `<text x="${branchX + 20}" y="${branchProductsY + 25}" font-family="${FONT_BODY}" font-size="11" letter-spacing="1" fill="${COLORS.textMuted}">PRODUCTS &amp; PIPELINE</text>`;
  svg += `<text x="${branchX + 20}" y="${branchProductsY + 57}" font-family="${FONT_MONO}" font-size="24" fill="${COLORS.text}">${products.length}</text>`;
  svg += `<text x="${branchX + 20}" y="${branchProductsY + 77}" font-family="${FONT_BODY}" font-size="12" fill="${COLORS.textSecondary}">${productsCaption}</text>`;

  // branch: subscriptions
  svg += `<rect x="${branchX}" y="${branchSubsY}" width="${branchW}" height="${branchH}" rx="7" fill="${COLORS.cardFill}" stroke="${COLORS.cardStroke}" stroke-width="1.2" />`;
  svg += `<text x="${branchX + 20}" y="${branchSubsY + 25}" font-family="${FONT_BODY}" font-size="11" letter-spacing="1" fill="${COLORS.textMuted}">SUBSCRIPTIONS &amp; COSTS</text>`;
  svg += `<text x="${branchX + 20}" y="${branchSubsY + 57}" font-family="${FONT_MONO}" font-size="24" fill="${COLORS.text}">~$${totalMonthly.toFixed(0)}<tspan font-size="14">/mo</tspan></text>`;
  svg += `<text x="${branchX + 20}" y="${branchSubsY + 77}" font-family="${FONT_BODY}" font-size="12" fill="${COLORS.textSecondary}">${paidSubs.length} paid tools</text>`;

  // branch: legal
  svg += `<rect x="${branchX}" y="${branchLegalY}" width="${branchW}" height="${branchH}" rx="7" fill="${COLORS.cardFill}" stroke="${COLORS.cardStroke}" stroke-width="1.2" />`;
  svg += `<text x="${branchX + 20}" y="${branchLegalY + 25}" font-family="${FONT_BODY}" font-size="11" letter-spacing="1" fill="${COLORS.textMuted}">LEGAL &amp; COMPLIANCE</text>`;
  svg += `<text x="${branchX + 20}" y="${branchLegalY + 57}" font-family="${FONT_MONO}" font-size="24" fill="${urgentLegal.length > 0 ? COLORS.warning : COLORS.text}">${urgentLegal.length}</text>`;
  svg += `<text x="${branchX + 20}" y="${branchLegalY + 77}" font-family="${FONT_BODY}" font-size="12" fill="${COLORS.textSecondary}">urgent (14d or less)</text>`;

  // leaves: products
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const leafY = 10 + i * rowH + (rowH - leafH) / 2;
    const { color, label } = statusColor(selectName(p, "Status"));
    svg += `<rect x="${leafX}" y="${leafY}" width="${leafW}" height="${leafH}" rx="7" fill="${COLORS.cardFill}" stroke="${COLORS.cardStroke}" stroke-width="1.2" />`;
    svg += `<text x="${leafX + 22}" y="${leafY + 28}" font-family="${FONT_BODY}" font-weight="700" font-size="15" fill="${COLORS.text}">${escapeXml(title(p))}</text>`;
    svg += `<text x="${leafX + 22}" y="${leafY + 47}" font-family="${FONT_BODY}" font-size="11" fill="${COLORS.textMuted}">${escapeXml(selectName(p, "Stage"))}</text>`;
    svg += `<circle cx="${leafX + 26}" cy="${leafY + 74}" r="4" fill="${color}" />`;
    svg += `<text x="${leafX + 36}" y="${leafY + 78}" font-family="${FONT_BODY}" font-size="11" fill="${COLORS.textSecondary}">${escapeXml(label)}</text>`;
  }

  svg += `<text x="${width - 12}" y="${height - 10}" text-anchor="end" font-family="${FONT_BODY}" font-size="10" fill="${COLORS.textMuted}">live &#183; ${now.toISOString().slice(0, 16).replace("T", " ")} UTC</text>`;
  svg += `</svg>`;
  return svg;
}

function renderErrorSvg(message) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 200" width="1000" height="200">
    <rect width="1000" height="200" fill="${COLORS.bg}" />
    <text x="30" y="90" font-family="${FONT_BODY}" font-size="16" fill="${COLORS.critical}">Command Center map temporarily unavailable</text>
    <text x="30" y="120" font-family="${FONT_BODY}" font-size="12" fill="${COLORS.textMuted}">${escapeXml(message).slice(0, 140)}</text>
  </svg>`;
}

function toPng(svg, width) {
  const { Resvg } = require("@resvg/resvg-js");
  const fontsDir = path.join(__dirname, "..", "fonts");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width * 2 },
    font: {
      fontFiles: [
        path.join(fontsDir, "Syne.ttf"),
        path.join(fontsDir, "DMSans.ttf"),
        path.join(fontsDir, "JetBrainsMono.ttf"),
      ],
      loadSystemFonts: false,
      defaultFontFamily: FONT_BODY,
    },
  });
  return resvg.render().asPng();
}

module.exports = async (req, res) => {
  const key = req.query?.key || new URL(req.url, "http://x").searchParams.get("key");
  if (!process.env.MAP_SECRET || key !== process.env.MAP_SECRET) {
    res.status(404).send("Not found");
    return;
  }

  const debug = req.query?.debug === "1";

  try {
    const [products, subscriptions, legal] = await Promise.all([
      queryDataSource(DATA_SOURCES.products),
      queryDataSource(DATA_SOURCES.subscriptions),
      queryDataSource(DATA_SOURCES.legal),
    ]);
    const svg = renderMap({ products, subscriptions, legal }, new Date());
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=300, s-maxage=300");
    res.status(200).send(toPng(svg, 1000));
  } catch (err) {
    if (debug) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.status(500).send(String(err && err.stack || err));
      return;
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=300, s-maxage=300");
    res.status(200).send(toPng(renderErrorSvg(err.message || String(err)), 1000));
  }
};
