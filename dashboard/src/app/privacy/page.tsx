import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Cortège",
  robots: { index: true, follow: true },
};

const wrap: React.CSSProperties = {
  maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px",
  color: "var(--color-text)", fontFamily: "var(--font-body)", lineHeight: 1.65, fontSize: 14.5,
};
const h1: React.CSSProperties = { fontFamily: "var(--font-heading)", fontSize: 26, fontWeight: 800, marginBottom: 6 };
const h2: React.CSSProperties = { fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, marginTop: 34, marginBottom: 10, color: "var(--color-text)" };
const p: React.CSSProperties = { color: "var(--color-text-soft)", margin: "0 0 12px" };
const meta: React.CSSProperties = { color: "var(--color-text-faint)", fontSize: 12.5, marginBottom: 30 };

export default function PrivacyPage() {
  return (
    <div style={wrap}>
      <h1 style={h1}>Privacy Policy</h1>
      <p style={meta}>Cortège by Solura Agency · Last updated: July 2026</p>

      <p style={p}>
        Cortège is an AI conversational assistant built by Solura Agency for wedding-industry
        businesses (initially a wedding venue/restaurant). Businesses using Cortège (&ldquo;Clients&rdquo;)
        connect their Telegram and/or Instagram business accounts so the assistant can answer their
        own customers&apos; (&ldquo;End Users&rdquo;) questions about pricing, packages, date availability, and
        partner vendors (photographers, florists, etc.), and hand off to a human staff member when
        needed. This policy explains what data Cortège processes and why.
      </p>

      <h2 style={h2}>1. Who this applies to</h2>
      <p style={p}>
        <b>Clients</b> — the business (e.g. a wedding venue) that contracts with Solura Agency to
        run Cortège on their Telegram bot and/or Instagram account.<br />
        <b>End Users</b> — people who message a Client&apos;s Telegram bot or Instagram account and
        receive automated responses from Cortège.
      </p>

      <h2 style={h2}>2. Data we collect and process</h2>
      <p style={p}>
        <b>Conversation content.</b> The text of messages exchanged between an End User and a
        Client&apos;s Telegram bot or Instagram account, so the assistant can generate a relevant
        reply and maintain context across a conversation.
      </p>
      <p style={p}>
        <b>Channel-scoped identifier.</b> The Telegram chat ID or Instagram-scoped user ID (IGSID)
        needed to route a reply to the correct conversation. We do not receive or store an End
        User&apos;s real name, email, or phone number unless they volunteer it in a message.
      </p>
      <p style={p}>
        <b>Conversation summaries and tags.</b> A short AI-generated summary of a past conversation
        (e.g. &ldquo;asked about the Silver package, date in June&rdquo;) so the assistant can recall context on
        a return visit, instead of re-reading the entire message history each time.
      </p>
      <p style={p}>
        <b>Business configuration data.</b> Pricing, packages, FAQ, partner vendor lists, and
        booking/cancellation policies that the Client provides — this describes the Client&apos;s
        business, not any individual End User.
      </p>
      <p style={p}>
        <b>Calendar availability.</b> Whether a given date is booked or free, synced from the
        Client&apos;s Google Calendar, so the assistant can answer availability questions accurately.
        We do not store the full contents of calendar events beyond what&apos;s needed to answer
        &ldquo;is this date available.&rdquo;
      </p>

      <h2 style={h2}>3. How data is processed</h2>
      <p style={p}>
        Message content is sent to OpenAI (GPT-4o / GPT-4o-mini) to generate the assistant&apos;s
        reply and to produce conversation summaries. Data is stored in a Postgres database (hosted
        by Supabase) segmented per Client (multi-tenant architecture &mdash; one Client never has access
        to another Client&apos;s data). Calendar availability is synced via the Google Calendar API.
        Messages are delivered over the Telegram Bot API and/or Meta&apos;s Instagram Messaging API,
        in compliance with each platform&apos;s messaging policies (including the 24-hour messaging
        window rule for Instagram).
      </p>

      <h2 style={h2}>4. Why we process this data</h2>
      <p style={p}>
        Solely to operate the assistant a Client has configured: answering End User questions about
        that Client&apos;s services, checking date availability, and escalating a conversation to a
        human staff member when the assistant cannot help (e.g. a price negotiation or a complaint).
        We do not use conversation data for advertising, and we do not sell End User data to third
        parties.
      </p>

      <h2 style={h2}>5. Data retention</h2>
      <p style={p}>
        Conversation history and summaries are retained for as long as the Client&apos;s account with
        Cortège is active, so the assistant can maintain context with returning End Users. A Client
        may request deletion of their account&apos;s data at any time by contacting us. An End User
        may request that their own conversation history be deleted by contacting the Client business
        directly, or by reaching us at the address below.
      </p>

      <h2 style={h2}>6. Your rights</h2>
      <p style={p}>
        You may request access to, correction of, or deletion of your data by contacting us at{" "}
        <a href="mailto:info@solura.agency">info@solura.agency</a>. We will respond within a
        reasonable time and delete data we are not otherwise required to retain.
      </p>

      <h2 style={h2}>7. Contact</h2>
      <p style={p}>
        Solura Agency — <a href="mailto:info@solura.agency">info@solura.agency</a>
      </p>
    </div>
  );
}
