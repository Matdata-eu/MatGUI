/**
 * The AI assistant of Yasgui: builds the prompt of a task from the active tab, asks the user for consent,
 * talks to the AI service (with optional check queries on the endpoint) and hands the answer to the AI panel.
 * Without an AI service it copies the prompt to the clipboard instead ("Copy for AI").
 */
import type { Yasgui } from "../";
import type Tab from "../Tab";
import { Parser } from "@matdata/yasr";
import type { AssistantRequest } from "@matdata/yasr";
import AiSettingsStore, { listConnections, resolveConnection } from "./aiSettings";
import { AiRequestError, chatCompletion, ChatMessage, ChatTool } from "./openaiClient";
import { AiTask, buildCopyPrompt, buildPrompt, needsSchema, QueryError } from "./prompts";
import { buildSchemaContext, SchemaTerm } from "./schemaContext";
import { CHECK_QUERY_LIMIT, formatBindings, prepareCheckQuery } from "./checkQuery";
import { AiConfig, AiConnection, AiTaskKind, defaultAiConfig } from "./types";
import AiPanel from "./AiPanel";

/** Pairs of question and answer kept for follow-up questions */
const MAX_HISTORY_MESSAGES = 12;
/** Timeout of one check query */
const CHECK_QUERY_TIMEOUT_MS = 20000;
const SPARQL_JSON = "application/sparql-results+json,application/sparql-results+xml;q=0.8";

const RUN_SPARQL_TOOL: ChatTool = {
  type: "function",
  function: {
    name: "run_sparql",
    description: `Run a small read-only SPARQL SELECT or ASK query on the user's endpoint and get at most ${CHECK_QUERY_LIMIT} result rows. Use it to check that classes, properties or values exist.`,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The SPARQL SELECT or ASK query, with its PREFIX declarations" },
        purpose: { type: "string", description: "What you want to check, in a few words, shown to the user" },
      },
      required: ["query"],
    },
  },
};

export interface CheckQueryReport {
  query: string;
  purpose?: string;
  /** Result shown to the user and sent to the model */
  result?: string;
  error?: string;
}

export interface AnswerMeta {
  model?: string;
  connection: AiConnection;
  totalTokens?: number;
}

function parsePrefixLines(text: string): { [prefix: string]: string } {
  const prefixes: { [prefix: string]: string } = {};
  const re = /PREFIX\s+([\w.-]*):\s*<([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text || ""))) prefixes[match[1]] = match[2];
  return prefixes;
}

export default class AiAssistant {
  public readonly config: AiConfig;
  public readonly settings: AiSettingsStore;
  public readonly panel: AiPanel;
  private history: ChatMessage[] = [];
  private toolsUnsupported = new Set<string>();
  private controller: AbortController | undefined;
  /** Service picked in the AI view for this session; the default of the settings when unset */
  private activeServiceId: string | undefined;

  constructor(private yasgui: Yasgui) {
    this.config = { ...defaultAiConfig, ...(yasgui.config.ai || {}) };
    this.settings = new AiSettingsStore(yasgui.getStorageId("ai"));
    this.panel = new AiPanel(yasgui, this);
    this.settings.onChange(() => this.panel.refresh());
  }

  /** The AI service requests go to, or undefined when only "Copy for AI" is available */
  public getConnection(): AiConnection | undefined {
    return resolveConnection(this.config, this.settings.get(), this.activeServiceId);
  }

  /** All services the user can pick in the AI view */
  public getConnections(): AiConnection[] {
    return listConnections(this.config, this.settings.get());
  }

  /** Use another service for the next questions, until the page is reloaded ("off" copies prompts instead) */
  public selectService(id: string | undefined) {
    this.activeServiceId = id;
    this.panel.refresh();
  }

  public isConnected(): boolean {
    return !!this.getConnection();
  }

  public checkQueriesEnabled(): boolean {
    return this.config.allowCheckQueries && this.settings.get().checkQueries !== false;
  }

  public isBusy(): boolean {
    return !!this.controller;
  }

  /** Start over: forget the earlier questions and answers */
  public newConversation() {
    this.cancel();
    this.history = [];
    this.panel.clear();
  }

  public cancel() {
    this.controller?.abort();
    this.controller = undefined;
  }

  /**
   * What can be fixed in the active tab: a syntax error, an endpoint error, or a query without results
   */
  public getQueryError(tab: Tab | undefined = this.yasgui.getTab()): QueryError | undefined {
    const yasqe = tab?.getYasqe();
    if (!tab || !yasqe) return undefined;
    if (!yasqe.queryValid && yasqe.syntaxError) {
      return { source: "syntax", line: yasqe.syntaxError.line, message: yasqe.syntaxError.message };
    }
    const results = tab.getYasr()?.results;
    const error = results?.getError();
    if (error) return { source: "endpoint", status: error.status, message: error.text || error.statusText };
    if (results && !results.getBoolean?.() && results.getVariables().length && !(results.getBindings() || []).length) {
      return { source: "noResults" };
    }
    return undefined;
  }

  public hasResults(tab: Tab | undefined = this.yasgui.getTab()): boolean {
    const results = tab?.getYasr()?.results;
    if (!results || results.getError()) return false;
    return results.getBoolean() !== undefined || (results.getBindings() || []).length > 0;
  }

  /** Builds a task from the active tab */
  public createTask(
    kind: AiTaskKind,
    extra: { question?: string; title?: string; error?: QueryError; pluginContext?: string } = {},
  ): AiTask | undefined {
    const tab = this.yasgui.getTab();
    if (!tab) return undefined;
    const query = tab.getYasqe()?.getValue() ?? tab.getQuery();
    const task: AiTask = {
      kind,
      title: extra.title || this.defaultTitle(kind, extra.error),
      question: extra.question,
      query,
      endpoint: tab.getEndpoint(),
      pluginContext: extra.pluginContext,
    };
    if (kind === "fix") task.error = extra.error || this.getQueryError(tab);
    if (kind === "explainResults") {
      const results = tab.getYasr()?.results;
      if (results) {
        const boolean = results.getBoolean();
        if (boolean !== undefined) {
          task.results = { table: `ASK result: ${boolean}`, shownRows: 1, totalRows: 1 };
        } else {
          const bindings = (results.getBindings() || []) as any[];
          const max = this.config.maxResultRows;
          task.results = {
            table: formatBindings(results.getVariables(), bindings, max),
            shownRows: Math.min(max, bindings.length),
            totalRows: bindings.length,
          };
        }
      }
    }
    return task;
  }

  private defaultTitle(kind: AiTaskKind, error?: QueryError): string {
    switch (kind) {
      case "ask":
        return "Question";
      case "fix":
        return error?.source === "noResults" ? "Why no results?" : "Fix query";
      case "explainQuery":
        return "Explain query";
      case "explainResults":
        return "Explain results";
      default:
        return "Question";
    }
  }

  /** Endpoint context for "Ask" and "Fix": prefixes, and the classes and properties used in the endpoint */
  private async getSchema(tab: Tab, query: string): Promise<{ context: string; summary: string }> {
    let classes: SchemaTerm[] = [];
    let properties: SchemaTerm[] = [];
    const describe = this.yasgui.endpointDescribe;
    if (describe) {
      try {
        [classes, properties] = await Promise.all([
          describe.getAutocompleteTerms(tab, "class"),
          describe.getAutocompleteTerms(tab, "property"),
        ]);
      } catch {
        // No terms: the model gets the prefixes only
      }
    }
    const prefixes = {
      ...parsePrefixLines(this.yasgui.persistentConfig.getPrefixes()),
      ...(tab.getYasqe()?.getPrefixesFromQuery() || {}),
    };
    const max = this.config.maxSchemaTerms;
    const context = buildSchemaContext(
      { endpoint: tab.getEndpoint(), prefixes, classes, properties, maxTerms: max },
      query,
    );
    const nClasses = Math.min(max, classes.length);
    const nProperties = Math.min(max, properties.length);
    const summary =
      nClasses || nProperties
        ? `the names of ${nClasses} classes and ${nProperties} properties used in the endpoint, with their counts`
        : "your prefixes";
    return { context, summary };
  }

  private async prepare(task: AiTask, withHistory: boolean, connection?: AiConnection) {
    const tab = this.yasgui.getTab();
    const schema = tab && needsSchema(task.kind) ? await this.getSchema(tab, task.query || "") : undefined;
    const checkQueries =
      connection && this.checkQueriesEnabled() && !this.toolsUnsupported.has(connection.baseUrl)
        ? { maxCalls: this.config.maxCheckQueries, rowLimit: CHECK_QUERY_LIMIT }
        : undefined;
    const options = {
      schemaContext: schema?.context,
      schemaSummary: schema?.summary,
      checkQueries,
      history: withHistory ? this.history.slice(-MAX_HISTORY_MESSAGES) : undefined,
    };
    return { options, built: buildPrompt(task, options) };
  }

  /** The "Copy for AI" text of a task */
  public async getCopyPrompt(task: AiTask): Promise<string> {
    const { options } = await this.prepare(task, false);
    return buildCopyPrompt(task, options);
  }

  /** Copies the prompt of a task to the clipboard and shows it in the AI panel */
  public async copy(task: AiTask): Promise<boolean> {
    const text = await this.getCopyPrompt(task);
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }
    this.panel.showCopied(task, text, copied);
    return copied;
  }

  /**
   * Runs a task: sends it to the AI service after the user's consent, or copies the prompt when no service is
   * set up.
   */
  public async run(task: AiTask | undefined): Promise<void> {
    if (!task) return;
    const connection = this.getConnection();
    if (!connection) {
      await this.copy(task);
      return;
    }
    if (!(task.query || "").trim() && task.kind !== "ask" && task.kind !== "plugin") {
      this.panel.showNotice("The editor is empty: write or open a query first.");
      return;
    }
    this.cancel();
    const withHistory = task.kind === "ask" || task.kind === "plugin";
    const { built } = await this.prepare(task, withHistory, connection);
    if (!this.settings.hasConsent(connection.host)) {
      const answer = await this.panel.askConsent(task, connection, built.includes);
      if (!answer.send) return;
      if (answer.remember) this.settings.addConsent(connection.host);
    }
    const view = this.panel.startAnswer(task, built.includes, connection);
    const controller = new AbortController();
    this.controller = controller;
    view.onCancel(() => this.cancel());
    try {
      const result = await this.complete(connection, built.messages, controller.signal, (report) =>
        view.addCheckQuery(report),
      );
      if (controller.signal.aborted) return;
      view.setSent(result.sent);
      view.setAnswer(result.content, { model: result.model, connection, totalTokens: result.totalTokens });
      // Keep the question and the answer for follow-up questions (without the endpoint context and check queries)
      const userMessage = built.messages[built.messages.length - 1];
      this.history.push(userMessage, { role: "assistant", content: result.content });
    } catch (e: any) {
      if (controller.signal.aborted || e?.name === "AbortError") {
        view.setCancelled();
      } else {
        view.setSent(built.messages);
        view.setError(e instanceof AiRequestError ? e.message : `Something went wrong: ${e?.message || e}`);
      }
    } finally {
      if (this.controller === controller) this.controller = undefined;
      this.panel.refresh();
    }
  }

  /** Chat completion with the check query loop */
  private async complete(
    connection: AiConnection,
    messages: ChatMessage[],
    signal: AbortSignal,
    onCheckQuery: (report: CheckQueryReport) => void,
  ): Promise<{ content: string; model?: string; totalTokens?: number; sent: ChatMessage[] }> {
    const conversation = [...messages];
    let useTools = this.checkQueriesEnabled() && !this.toolsUnsupported.has(connection.baseUrl);
    let checks = 0;
    let totalTokens = 0;
    for (;;) {
      const tools = useTools && checks < this.config.maxCheckQueries ? [RUN_SPARQL_TOOL] : undefined;
      let response;
      try {
        response = await chatCompletion(connection, {
          messages: conversation,
          tools,
          signal,
          timeoutMs: this.config.timeoutMs,
        });
      } catch (e) {
        if (e instanceof AiRequestError && e.toolsUnsupported && tools) {
          // The service or model doesn't support tools: answer without check queries
          this.toolsUnsupported.add(connection.baseUrl);
          useTools = false;
          continue;
        }
        throw e;
      }
      totalTokens += response.usage?.total_tokens || 0;
      const calls = response.message.tool_calls || [];
      if (!calls.length || !tools) {
        return {
          content: response.message.content || "",
          model: response.model,
          totalTokens: totalTokens || undefined,
          sent: conversation,
        };
      }
      conversation.push({ role: "assistant", content: response.message.content || null, tool_calls: calls });
      for (const call of calls) {
        let output: string;
        if (call.function.name !== "run_sparql" || checks >= this.config.maxCheckQueries) {
          output = "This tool call is not available. Answer with what you know.";
        } else {
          checks++;
          let args: { query?: string; purpose?: string } = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = {};
          }
          const report = await this.runCheckQuery(args.query || "", args.purpose, signal);
          onCheckQuery(report);
          output = report.error ? `Error: ${report.error}` : report.result || "";
        }
        conversation.push({ role: "tool", tool_call_id: call.id, content: output });
      }
      if (signal.aborted) throw Object.assign(new Error("Cancelled"), { name: "AbortError" });
    }
  }

  /** Runs a check query of the model on the endpoint of the active tab */
  private async runCheckQuery(query: string, purpose: string | undefined, signal: AbortSignal) {
    const prepared = prepareCheckQuery(query);
    if (prepared.ok === false) return { query, purpose, error: prepared.reason };
    const tab = this.yasgui.getTab();
    if (!tab) return { query: prepared.query, purpose, error: "No query tab is open." };
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal.addEventListener("abort", onAbort);
    const timer = setTimeout(() => controller.abort(), CHECK_QUERY_TIMEOUT_MS);
    try {
      const response = await tab.runBackgroundQuery(prepared.query, {
        accept: SPARQL_JSON,
        signal: controller.signal,
        skipGraphArgs: false,
      });
      const parser = new Parser(response);
      if (parser.hasError()) {
        const error = parser.getError();
        return {
          query: prepared.query,
          purpose,
          error: (error?.text || error?.statusText || "Query failed").slice(0, 1500),
        };
      }
      const boolean = parser.getBoolean();
      const result =
        boolean !== undefined
          ? `ASK result: ${boolean}`
          : formatBindings(parser.getVariables(), (parser.getBindings() || []) as any[], CHECK_QUERY_LIMIT);
      return { query: prepared.query, purpose, result };
    } catch (e: any) {
      const message =
        controller.signal.aborted && !signal.aborted ? "The check query timed out." : e?.message || String(e);
      return { query: prepared.query, purpose, error: message };
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    }
  }

  /** Entry point for `yasr.askAssistant()` of plugins */
  public askFromPlugin(request: AssistantRequest) {
    this.panel.open();
    void this.run(
      this.createTask("plugin", { title: request.title, question: request.prompt, pluginContext: request.context }),
    );
  }

  public destroy() {
    this.cancel();
    this.panel.destroy();
  }
}
