/**
 * Streams one reply through Vercel AI Gateway, to check that the gateway key and model work.
 * Usage: pnpm tsx scripts/ai-gateway-stream.ts ["prompt"]
 * Needs AI_GATEWAY_API_KEY (or VERCEL_OIDC_TOKEN from `vercel env pull`). AI_GATEWAY_MODEL overrides the model.
 */
import { streamText } from 'ai';

const model = process.env.AI_GATEWAY_MODEL || 'openai/gpt-6-astra';
const prompt = process.argv[2] || 'In two sentences, what is the Liturgy of the Word at Mass?';

async function main() {
  let failed: unknown = null;
  const result = streamText({
    model,
    prompt,
    onError({ error }) {
      failed = error;
    },
  });
  for await (const part of result.textStream) process.stdout.write(part);
  process.stdout.write('\n');
  if (failed) throw failed;
  const usage = await result.usage;
  console.error(`\n[${model}] finish: ${await result.finishReason}, tokens in/out: ${usage.inputTokens}/${usage.outputTokens}`);
}

main().catch((e) => {
  console.error(`AI Gateway request failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
