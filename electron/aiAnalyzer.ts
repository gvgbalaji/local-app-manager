import OpenAI from 'openai';
import type { Settings } from './settings';

type LogFn = (msg: string) => void;

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\x1B\][^\x07]*(\x07|\x1B\\)/g, '');
}

function createClient(s: Settings): OpenAI {
  return new OpenAI({
    apiKey: s.llmApiKey || 'no-key-needed',
    baseURL: s.llmBaseUrl,
    // Prevent the SDK from reading process.env.OPENAI_API_KEY
    dangerouslyAllowBrowser: false,
  });
}

async function callLLM(s: Settings, systemPrompt: string, userContent: string, log: LogFn): Promise<string> {
  const cleanContent = stripAnsi(userContent).slice(-8000);
  log(`Calling ${s.llmProvider} (${s.llmModel}) with ${cleanContent.length} chars of log...`);

  const client = createClient(s);
  const response = await client.chat.completions.create({
    model: s.llmModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: cleanContent },
    ],
    max_tokens: 300,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content ?? '';
  log(`Response: ${content}`);
  return content;
}

function extractJson(text: string): Record<string, unknown> {
  // Strip code fences, find first JSON object
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON found in: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]) as Record<string, unknown>;
}

function toPort(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : undefined;
}

export interface DetectedPorts {
  rest?: number;
  grpc?: number;
  frontend?: number;
}

export async function analyzeLogsForPorts(logs: string, settings: Settings, log: LogFn): Promise<DetectedPorts> {
  const system = `You are a log analyzer. Extract port numbers from application startup logs.
Identify ports for: REST API server (rest), gRPC server (grpc), frontend/web server (frontend).
Return ONLY a valid JSON object, no other text: {"rest": <number or null>, "grpc": <number or null>, "frontend": <number or null>}
Common log patterns: "listening on port N", "server started on :N", "Local: http://localhost:N", "PORT=N", "running at http://localhost:N".
Use null when a port type is not found.`;

  const result = await callLLM(settings, system, logs, log);
  try {
    const parsed = extractJson(result);
    const ports: DetectedPorts = {
      rest: toPort(parsed.rest),
      grpc: toPort(parsed.grpc),
      frontend: toPort(parsed.frontend),
    };
    log(`Parsed ports: ${JSON.stringify(ports)}`);
    return ports;
  } catch (err) {
    log(`Port JSON parse error: ${String(err)}`);
    return {};
  }
}

export async function analyzeFailure(logs: string, settings: Settings, log: LogFn): Promise<{ reason: string; action: string }> {
  const system = `You are a log analyzer. These logs are from a service that failed to start.
Identify the primary reason for failure and a specific corrective action.
Return ONLY a valid JSON object, no other text: {"reason": "<brief reason>", "action": "<corrective action>"}`;

  const result = await callLLM(settings, system, logs, log);
  try {
    const parsed = extractJson(result);
    return {
      reason: String(parsed.reason ?? 'Unknown error'),
      action: String(parsed.action ?? 'Check the logs for details'),
    };
  } catch (err) {
    log(`Failure JSON parse error: ${String(err)}`);
    return { reason: 'Unknown error', action: 'Check the logs for details' };
  }
}
