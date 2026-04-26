import * as https from 'https';

type LogFn = (msg: string) => void;

interface GroqResponse {
  choices: Array<{ message: { content: string } }>;
  error?: { message: string };
}

function stripAnsi(str: string): string {
  // Remove ANSI escape codes (color, cursor, etc.)
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').replace(/\x1B\][^\x07]*(\x07|\x1B\\)/g, '');
}

async function callGroq(apiKey: string, systemPrompt: string, userContent: string, log: LogFn): Promise<string> {
  const cleanContent = stripAnsi(userContent).slice(-8000);
  log(`Sending ${cleanContent.length} chars of (ANSI-stripped) logs to Groq...`);

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: cleanContent },
      ],
      max_tokens: 300,
      temperature: 0.1,
    });

    const req = https.request(
      {
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        log(`Groq HTTP status: ${res.statusCode}`);
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data) as GroqResponse;
            if (parsed.error) {
              const msg = `Groq API error: ${parsed.error.message}`;
              log(msg);
              reject(new Error(msg));
              return;
            }
            const content = parsed.choices?.[0]?.message?.content ?? '';
            log(`Groq raw response: ${content}`);
            resolve(content);
          } catch {
            log(`Groq parse error. Raw response: ${data.slice(0, 500)}`);
            reject(new Error(`Failed to parse Groq response`));
          }
        });
      }
    );
    req.on('error', (err: Error) => {
      log(`Groq network error: ${err.message}`);
      reject(err);
    });
    req.write(body);
    req.end();
  });
}

function extractJson(text: string): Record<string, unknown> {
  // Try to find a JSON object in the response, handling code fences
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON object found in: ${text.slice(0, 200)}`);
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

export async function analyzeLogsForPorts(logs: string, apiKey: string, log: LogFn): Promise<DetectedPorts> {
  const system = `You are a log analyzer. Extract port numbers from application startup logs.
Identify which ports are for: REST API server (rest), gRPC server (grpc), frontend/web server (frontend).
Return ONLY a valid JSON object with no other text: {"rest": <number or null>, "grpc": <number or null>, "frontend": <number or null>}
Use null when a port type is not found. Common patterns: "listening on port N", "server started on :N", "Local: http://localhost:N", "PORT=N".`;

  const result = await callGroq(apiKey, system, logs, log);
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

export async function analyzeFailure(logs: string, apiKey: string, log: LogFn): Promise<{ reason: string; action: string }> {
  const system = `You are a log analyzer. These logs are from a service that failed to start.
Identify the primary reason for failure and a specific corrective action.
Return ONLY a valid JSON object: {"reason": "<brief reason>", "action": "<corrective action>"}
Be concise. No other text outside the JSON.`;

  const result = await callGroq(apiKey, system, logs, log);
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
