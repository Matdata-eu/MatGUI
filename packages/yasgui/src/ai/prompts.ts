/**
 * Prompts of the AI assistant. Each task becomes a list of chat messages plus a plain description of what is
 * included, which is shown to the user before anything is sent.
 */
import type { ChatMessage } from "./openaiClient";
import type { AiTaskKind } from "./types";

export interface QueryError {
  /** "syntax" for an error found by the editor, "endpoint" for an error answered by the endpoint */
  source: "syntax" | "endpoint" | "noResults";
  message?: string;
  status?: number;
  line?: number;
}

export interface ResultsSample {
  table: string;
  shownRows: number;
  totalRows: number;
}

export interface AiTask {
  kind: AiTaskKind;
  /** Title shown above the answer */
  title: string;
  /** The question of the user ("ask") or of a plugin ("plugin") */
  question?: string;
  query?: string;
  endpoint?: string;
  error?: QueryError;
  results?: ResultsSample;
  /** Extra context handed by a plugin */
  pluginContext?: string;
}

export interface BuiltPrompt {
  messages: ChatMessage[];
  /** What is sent, in plain words, for the privacy notice */
  includes: string[];
}

export interface PromptOptions {
  /** Endpoint context from [[buildSchemaContext]], or undefined when the task doesn't need it */
  schemaContext?: string;
  /** Short description of the schema context for the privacy notice */
  schemaSummary?: string;
  /** Whether the model may call `run_sparql` */
  checkQueries?: { maxCalls: number; rowLimit: number };
  /** Earlier messages of the conversation (follow-up questions) */
  history?: ChatMessage[];
}

const MAX_ERROR_LENGTH = 3000;
const MAX_QUERY_LENGTH = 20000;

function codeBlock(query: string): string {
  const text = query.length > MAX_QUERY_LENGTH ? query.slice(0, MAX_QUERY_LENGTH) + "\n# (query truncated)" : query;
  return "```sparql\n" + text.trim() + "\n```";
}

export function baseInstructions(checkQueries?: PromptOptions["checkQueries"]): string {
  const lines = [
    "You are the SPARQL assistant of MatGUI, a SPARQL query editor. You help users write, fix and understand SPARQL 1.1 queries for their endpoint.",
    "Rules:",
    "- Put each complete query in its own ```sparql code block, with all the PREFIX declarations it needs, so the user can run it as is.",
    "- Prefer the classes and properties listed in the endpoint context. Do not invent names; when you are not sure a name exists, say so.",
    "- Add a LIMIT to exploratory queries.",
    "- Be concise and concrete. Answer in the language of the user's question.",
  ];
  if (checkQueries) {
    lines.push(
      `- You can call the run_sparql tool to run a small read-only SELECT or ASK query on the endpoint (at most ${checkQueries.rowLimit} rows) to check that a class, property or value exists before you answer. Use it only when it helps, at most ${checkQueries.maxCalls} times. Never use it to run the user's full query.`,
    );
  }
  return lines.join("\n");
}

function describeError(error: QueryError): string {
  if (error.source === "noResults") return "The query runs without errors but returns no results.";
  if (error.source === "syntax") {
    return `The editor reports a syntax error${error.line ? ` on line ${error.line}` : ""}: ${error.message || "syntax error"}`;
  }
  const message = (error.message || "").slice(0, MAX_ERROR_LENGTH);
  return `The endpoint answered with an error${error.status ? ` (HTTP ${error.status})` : ""}:\n${message || "(no error message)"}`;
}

/** The user message of a task, and what it includes besides the endpoint context */
function taskMessage(task: AiTask): { content: string; includes: string[] } {
  const includes: string[] = [];
  const parts: string[] = [];
  const query = (task.query || "").trim();
  switch (task.kind) {
    case "ask":
      parts.push(task.question || "");
      includes.push("your question");
      if (query) {
        parts.push("The query currently in the editor (it may be unrelated to the question):\n" + codeBlock(query));
        includes.push("the query in the editor");
      }
      break;
    case "fix":
      if (task.error?.source === "noResults") {
        parts.push(
          "This query returns no results. Find the most likely reasons (for example class or property names that are not used in the endpoint, a wrong graph, wrong literal types or language tags, or filters that are too strict) and give a corrected query.",
        );
      } else {
        parts.push("This query fails. Explain briefly why, then give the corrected query.");
      }
      parts.push(codeBlock(query));
      includes.push("the query in the editor");
      if (task.error) {
        parts.push(describeError(task.error));
        if (task.error.source !== "noResults") includes.push("the error message");
      }
      break;
    case "explainQuery":
      parts.push(
        "Explain what this query does, in plain language, for someone who knows the domain but not SPARQL. Start with a one-sentence summary, then walk through the parts of the query. Mention possible problems (for example performance or a missing LIMIT) briefly at the end.",
      );
      parts.push(codeBlock(query));
      includes.push("the query in the editor");
      break;
    case "explainResults":
      parts.push(
        "Summarise and explain these query results: what they show, notable patterns or values, and anything that looks wrong or surprising. Do not repeat the table.",
      );
      parts.push("Query:\n" + codeBlock(query));
      includes.push("the query in the editor");
      if (task.results) {
        const { shownRows, totalRows, table } = task.results;
        parts.push(
          `Results (${shownRows === totalRows ? `all ${totalRows} rows` : `first ${shownRows} of ${totalRows} rows`}, tab separated):\n${table}`,
        );
        includes.push(
          shownRows === totalRows
            ? `all ${totalRows} result rows`
            : `the first ${shownRows} of ${totalRows} result rows`,
        );
      }
      break;
    case "plugin":
      parts.push(task.question || task.title);
      includes.push(`the question of the plugin (“${task.title}”)`);
      if (task.pluginContext) {
        parts.push("Context:\n" + task.pluginContext);
        includes.push("the context the plugin provides");
      }
      if (query) {
        parts.push("The query that produced the results:\n" + codeBlock(query));
        includes.push("the query in the editor");
      }
      break;
  }
  return { content: parts.filter(Boolean).join("\n\n"), includes };
}

/** Tasks that send the classes and properties of the endpoint as context */
export function needsSchema(kind: AiTaskKind): boolean {
  return kind === "ask" || kind === "fix";
}

export function buildPrompt(task: AiTask, options: PromptOptions = {}): BuiltPrompt {
  const system = [baseInstructions(options.checkQueries)];
  const includes: string[] = [];
  if (options.schemaContext) {
    system.push("Endpoint context:\n" + options.schemaContext);
  } else if (task.endpoint) {
    system.push(`SPARQL endpoint: ${task.endpoint}`);
  }
  if (task.endpoint) includes.push(`the endpoint URL (${task.endpoint})`);
  if (options.schemaContext && options.schemaSummary) includes.push(options.schemaSummary);
  const message = taskMessage(task);
  includes.push(...message.includes);
  if (options.history?.length) includes.push("the earlier messages of this conversation");
  return {
    messages: [
      { role: "system", content: system.join("\n\n") },
      ...(options.history || []),
      { role: "user", content: message.content },
    ],
    includes,
  };
}

/**
 * One block of plain text with the same instructions, context and question, to paste in any AI chat
 * ("Copy for AI").
 */
export function buildCopyPrompt(task: AiTask, options: Omit<PromptOptions, "checkQueries" | "history"> = {}): string {
  const built = buildPrompt(task, { ...options, checkQueries: undefined, history: undefined });
  return built.messages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n\n---\n\n");
}

/** The SPARQL code blocks of an answer */
export function extractQueries(answer: string): string[] {
  const queries: string[] = [];
  const re = /```[ \t]*([\w-]*)[^\n]*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(answer))) {
    const lang = match[1].toLowerCase();
    const code = match[2].trim();
    if (lang === "sparql" || lang === "rq" || (!lang && looksLikeSparql(code))) queries.push(code);
  }
  return queries;
}

export function looksLikeSparql(code: string): boolean {
  return /\b(SELECT|ASK|CONSTRUCT|DESCRIBE)\b[\s\S]*\{|\bPREFIX\s+[\w.-]*:/i.test(code);
}
