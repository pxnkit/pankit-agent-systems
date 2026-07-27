import { selectChatProvider } from "../../../lib/chat/provider.mjs";
import { getPortfolioRuntimeData } from "../../../lib/portfolio-data";
import {
  getChatRuntimeConfig,
  getPortfolioRuntimeBindings,
} from "../../../lib/runtime-env";

export const runtime = "edge";

export async function GET() {
  const data = getPortfolioRuntimeData();
  const runtimeConfig = getChatRuntimeConfig(
    await getPortfolioRuntimeBindings(),
  );
  const provider = selectChatProvider({
    ai: runtimeConfig.ai,
    model: runtimeConfig.model,
    mockMode: runtimeConfig.mockMode,
  });
  const healthy = data.projects.length > 0 && data.chunks.length > 0;

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      chatMode: provider.id,
      index: {
        projects: data.projects.length,
        chunks: data.chunks.length,
        generatedKnowledgeLoaded: data.generatedKnowledgeLoaded,
        validationIssues: data.issues.length,
      },
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
