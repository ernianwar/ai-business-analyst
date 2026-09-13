import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/auth/get-context";
import { validateIdeaInput, wrapUntrustedInput } from "@/lib/security/sanitize";
import { checkAIRateLimit } from "@/lib/security/ai-rate-limiter";

const TAVILY_RESEARCH_ENDPOINT = "https://api.tavily.com/research";
const TAVILY_RESEARCH_GET = "https://api.tavily.com/research";

type ResearchDimension = {
  dimension: string;
  score: number;
  weight: number;
  reasoning: string;
  confidence: "high" | "medium" | "low";
  evidence: Array<{
    claim: string;
    evidence: string;
    source_title: string;
    source_url: string;
    source_quality: "high" | "medium" | "low";
    confidence: "high" | "medium" | "low";
  }>;
};

type ResearchOutput = {
  targetCustomer: string;
  customerProblem: string;
  keyOpportunity: string;
  recommendation: string;
  nextAction: string;
  dimensions: ResearchDimension[];
};

function normalizeQuality(
  text: string
): "high" | "medium" | "low" {
  const lower = text.toLowerCase();

  if (
    /(gov|government|official|statistics|university|research institute|association|ministry|department|regulator)/i.test(
      lower
    )
  ) {
    return "high";
  }

  if (
    /(reuters|forbes|business times|industry|report|publication|news)/i.test(
      lower
    )
  ) {
    return "medium";
  }

  return "low";
}

async function createResearchTask(
  idea: string,
  apiKey: string
) {
  const response = await fetch(TAVILY_RESEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: `
Evaluate this business opportunity specifically for the stated idea:

<untrusted_user_input>
${idea}
</untrusted_user_input>

Research the actual business/domain mentioned in the idea.

Do NOT assume that the opportunity is about AI training, consulting,
SMEs, workforce training, or digitalisation unless the user's idea
explicitly says so.

Analyse:

1. Target customer segments
2. Customer problems and pain points
3. Market demand
4. Revenue and pricing potential
5. Competitors and substitutes
6. Market growth and trends
7. Regulatory or market risks
8. Execution feasibility

For the six weighted dimensions, provide a score from 0 to 10.
The score must be based on evidence found during the research.

The six dimensions are:

- Market Demand: 25%
- Customer Pain: 20%
- Revenue Potential: 20%
- Competitive Opportunity: 15%
- Market Growth: 10%
- Execution Feasibility: 10%

Use Malaysia or Peninsular Malaysia context when the user's idea
specifies Malaysia or Peninsular Malaysia.

Keep the analysis specific to the actual opportunity.
Do not reuse assumptions from unrelated business categories.

Every evidence item must correspond to a source actually found
during the research.
      `,
      model: "mini",
      stream: false,
      output_schema: {
        type: "object",
        properties: {
          targetCustomer: {
            type: "string",
          },
          customerProblem: {
            type: "string",
          },
          keyOpportunity: {
            type: "string",
          },
          recommendation: {
            type: "string",
          },
          nextAction: {
            type: "string",
          },
          dimensions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                dimension: {
                  type: "string",
                },
                score: {
                  type: "number",
                },
                weight: {
                  type: "number",
                },
                reasoning: {
                  type: "string",
                },
                confidence: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                },
                evidence: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      claim: {
                        type: "string",
                      },
                      evidence: {
                        type: "string",
                      },
                      source_title: {
                        type: "string",
                      },
                      source_url: {
                        type: "string",
                      },
                      source_quality: {
                        type: "string",
                        enum: ["high", "medium", "low"],
                      },
                      confidence: {
                        type: "string",
                        enum: ["high", "medium", "low"],
                      },
                    },
                    required: [
                      "claim",
                      "evidence",
                      "source_title",
                      "source_url",
                      "source_quality",
                      "confidence",
                    ],
                  },
                },
              },
              required: [
                "dimension",
                "score",
                "weight",
                "reasoning",
                "confidence",
                "evidence",
              ],
            },
          },
        },
        required: [
          "targetCustomer",
          "customerProblem",
          "keyOpportunity",
          "recommendation",
          "nextAction",
          "dimensions",
        ],
      },
    }),
    cache: "no-store",
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `Tavily Research error ${response.status}: ${raw}`
    );
  }

  return JSON.parse(raw);
}

async function getResearchTask(
  requestId: string,
  apiKey: string
) {
  const response = await fetch(
    `${TAVILY_RESEARCH_GET}/${requestId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    }
  );

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `Tavily Research status error ${response.status}: ${raw}`
    );
  }

  return JSON.parse(raw);
}

async function waitForResearch(
  requestId: string,
  apiKey: string
) {
  const maxAttempts = 30;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await getResearchTask(
      requestId,
      apiKey
    );

    console.log(
      `[SALAM LIT] Tavily Research status: ${result?.status}`
    );

    if (result?.status === "completed") {
      return result;
    }

    if (
      result?.status === "failed" ||
      result?.status === "cancelled"
    ) {
      throw new Error(
        `Tavily Research ${result.status}.`
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 2000)
    );
  }

  throw new Error(
    "Tavily Research timed out before completion."
  );
}

function buildSources(
  research: any
) {
  const sourceMap = new Map<
    string,
    {
      title: string;
      url: string;
    }
  >();

  const tavilySources = Array.isArray(research?.sources)
    ? research.sources
    : [];

  for (const source of tavilySources) {
    if (source?.url) {
      sourceMap.set(source.url, {
        title: source.title || "Untitled source",
        url: source.url,
      });
    }
  }

  return sourceMap;
}

function buildEvidence(
  research: any,
  output: ResearchOutput
) {
  const sourceMap = buildSources(research);
  const evidence: any[] = [];

  for (const dimension of output.dimensions || []) {
    for (const item of dimension.evidence || []) {
      if (!item.source_url) continue;

      const verifiedSource =
        sourceMap.get(item.source_url);

      if (!verifiedSource) continue;

      evidence.push({
        claim: item.claim,
        evidence: item.evidence,
        source_title:
          verifiedSource.title ||
          item.source_title ||
          "Untitled source",
        source_url: item.source_url,
        source_quality:
          item.source_quality ||
          normalizeQuality(
            `${verifiedSource.title} ${item.source_url}`
          ),
        confidence:
          item.confidence || dimension.confidence,
      });
    }
  }

  return evidence.filter(
    (item, index, array) =>
      array.findIndex(
        (x) => x.source_url === item.source_url
      ) === index
  );
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthenticatedContext();

    if (!ctx || !ctx.business_id) {
      return NextResponse.json(
        { error: "Business context required. Complete onboarding first.", code: "NO_BUSINESS" },
        { status: 404 }
      );
    }

    // Rate limit enforcement (this route calls external Tavily API, not the model gateway)
    const rateLimit = await checkAIRateLimit({
      user_id: ctx.user_id,
      business_id: ctx.business_id,
      endpoint: "research",
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later.", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    const apiKey =
      process.env.TAVILY_API_KEY?.trim();

    if (!apiKey) {
      throw new Error(
        "Server cannot see TAVILY_API_KEY. Restart Next.js after saving .env.local."
      );
    }

    const body = await request.json();
    const ideaRaw = String(body?.idea || "").trim();

    if (!ideaRaw) {
      throw new Error("Missing opportunity idea.");
    }

    // M10: Input length validation
    const ideaValidation = validateIdeaInput(ideaRaw);
    if (!ideaValidation.valid) {
      throw new Error(ideaValidation.error);
    }
    const idea = ideaValidation.value!;

    console.log(
      "[SALAM LIT] Starting Tavily Research:",
      idea
    );

    const task = await createResearchTask(
      idea,
      apiKey
    );

    const requestId = task?.request_id;

    if (!requestId) {
      throw new Error(
        "Tavily Research did not return a request ID."
      );
    }

    console.log(
      "[SALAM LIT] Research request:",
      requestId
    );

    const research = await waitForResearch(
      requestId,
      apiKey
    );

    const rawContent = research?.content;

    if (!rawContent) {
      throw new Error(
        "Tavily Research returned no content."
      );
    }

    const output: ResearchOutput =
      typeof rawContent === "string"
        ? JSON.parse(rawContent)
        : rawContent;

    if (
      !output.targetCustomer ||
      !output.customerProblem ||
      !output.keyOpportunity
    ) {
      throw new Error(
        "Tavily Research returned incomplete structured analysis."
      );
    }

    const dimensions = Array.isArray(
      output.dimensions
    )
      ? output.dimensions.map((dimension) => ({
          ...dimension,
          score: Math.max(
            0,
            Math.min(10, Number(dimension.score) || 0)
          ),
          weight: Number(dimension.weight) || 0,
        }))
      : [];

    if (dimensions.length !== 6) {
      throw new Error(
        `Expected 6 dimensions but received ${dimensions.length}.`
      );
    }

    const totalWeight = dimensions.reduce(
      (sum, dimension) => sum + dimension.weight,
      0
    );

    if (totalWeight <= 0) {
      throw new Error(
        "Invalid dimension weights returned by research."
      );
    }

    const score = Math.round(
      (dimensions.reduce(
        (sum, dimension) =>
          sum +
          dimension.score *
            (dimension.weight / totalWeight),
        0
      )) * 10
    );

    const highConfidence =
      dimensions.filter(
        (dimension) =>
          dimension.confidence === "high"
      ).length;

    const confidence =
      highConfidence >= 4
        ? "High"
        : highConfidence >= 2
        ? "Medium"
        : "Low";

    const verdict =
      score >= 75
        ? "Strong"
        : score >= 50
        ? "Moderate"
        : "Weak";

    const sources = buildEvidence(
      research,
      output
    );

    if (!sources.length) {
      throw new Error(
        "Research completed but no verifiable evidence sources were returned."
      );
    }

    const researchNotes = dimensions.flatMap(
      (dimension) =>
        dimension.evidence
          .slice(0, 2)
          .map(
            (item) =>
              `${dimension.dimension}: ${item.claim}`
          )
    );

    return NextResponse.json({
      result: {
        score,
        confidence,
        verdict,

        targetCustomer:
          output.targetCustomer,

        customerProblem:
          output.customerProblem,

        keyOpportunity:
          output.keyOpportunity,

        recommendation:
          output.recommendation,

        nextAction:
          output.nextAction,

        plan: [
          "Understand the objective",
          "Identify target customers and pain points",
          "Analyse competitors and substitutes",
          "Review market demand and pricing signals",
          "Review market growth and industry trends",
          "Assess risks and execution feasibility",
          "Make a recommendation",
        ],

        sources,
        dimensions,
        researchNotes,
      },
    });
  } catch (error) {
    console.error(
      "[SALAM LIT] Research error:",
      error
    );

    const message = error instanceof Error ? error.message : "Live research could not be completed.";
    if (message.includes("Unauthenticated")) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}
