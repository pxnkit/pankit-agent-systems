import {
  CLOUDFLARE_MODELS,
  selectChatProvider,
} from "../../../lib/chat/provider.mjs";
import { getPortfolioRuntimeData } from "../../../lib/portfolio-data";
import {
  getChatRuntimeConfig,
  getPortfolioRuntimeBindings,
} from "../../../lib/runtime-env";

const SNAPSHOT_STALE_SECONDS = 30 * 24 * 60 * 60;

function snapshotAge(generatedAt: string | null) {
  if (!generatedAt) return { seconds: null, stale: true };
  const timestamp = Date.parse(generatedAt);
  if (!Number.isFinite(timestamp)) return { seconds: null, stale: true };
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1_000));
  return { seconds, stale: seconds > SNAPSHOT_STALE_SECONDS };
}

export async function GET() {
  const data = getPortfolioRuntimeData();
  const runtimeConfig = getChatRuntimeConfig(
    await getPortfolioRuntimeBindings(),
  );
  const provider = selectChatProvider({
    ai: runtimeConfig.ai,
    aiMode: runtimeConfig.aiMode,
    enableEconomyRouting: runtimeConfig.economyRoutingEnabled,
  });
  const primaryModel = CLOUDFLARE_MODELS.primary;
  const modelConfigured =
    runtimeConfig.aiMode !== "cloudflare" ||
    runtimeConfig.primaryModel === primaryModel;
  const chatConfigured =
    provider.configured !== false &&
    modelConfigured &&
    runtimeConfig.turnstilePairingOk;
  const age = snapshotAge(data.snapshotGeneratedAt);
  const healthy =
    chatConfigured && data.mandatoryRetrievalChecks.allPassed && !age.stale;

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      chatConfigured,
      aiMode: runtimeConfig.aiMode,
      primaryModel,
      turnstilePairingOk: runtimeConfig.turnstilePairingOk,
      indexedProjects: data.indexedProjects,
      knowledgeChunks: data.knowledgeChunks,
      profileSources: data.profileSources,
      corpusVersion: data.corpusVersion,
      snapshotAge: age,
      mandatoryRetrievalChecks: data.mandatoryRetrievalChecks,
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
