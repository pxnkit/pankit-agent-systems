import { ChatShell } from "@/components/chat/chat-shell";

export const metadata = {
  title: "Portfolio research guide",
  description:
    "Ask grounded questions about Pankit Brahmkhatri’s research projects in agent memory, search, retrieval, and verification.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <main id="main-content" className="chat-page">
      <ChatShell />
    </main>
  );
}
