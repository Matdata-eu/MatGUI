/**
 * The "AI" view of the side panel: quick actions (explain or fix the query, explain the results), a question
 * box, and the answers. Every answer shows what was sent and to whom, and every check query the model ran.
 */
import type { Yasgui } from "../";
import { icon, iconButton } from "../icons";
import type AiAssistant from "./AiAssistant";
import type { AnswerMeta, CheckQueryReport } from "./AiAssistant";
import type { ChatMessage } from "./openaiClient";
import type { AiTask } from "./prompts";
import { extractQueries, looksLikeSparql } from "./prompts";
import { renderMarkdown } from "./markdown";
import { AI_SERVICE_OFF } from "./types";
import type { AiConnection } from "./types";
import "./AiPanel.scss";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(label: string, className: string, title?: string): HTMLButtonElement {
  const b = el("button", className, label);
  b.type = "button";
  if (title) b.title = title;
  return b;
}

/** Readable text of the messages sent, for "What was sent" */
export function formatSentMessages(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      if (m.role === "tool") return `[check query result]\n${m.content}`;
      if (m.role === "assistant" && m.tool_calls?.length) {
        return `[assistant asked to run a check query]\n${m.tool_calls.map((c) => c.function.arguments).join("\n")}`;
      }
      return `[${m.role}]\n${m.content || ""}`;
    })
    .join("\n\n");
}

export interface AnswerView {
  addCheckQuery(report: CheckQueryReport): void;
  setAnswer(markdown: string, meta: AnswerMeta): void;
  setError(message: string): void;
  setCancelled(): void;
  setSent(messages: ChatMessage[]): void;
  onCancel(listener: () => void): void;
}

export default class AiPanel {
  private rootEl: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private actionsEl: HTMLDivElement;
  private logEl: HTMLDivElement;
  private inputEl: HTMLTextAreaElement;
  private sendButton: HTMLButtonElement;
  private fixButton!: HTMLButtonElement;
  private explainButton!: HTMLButtonElement;
  private resultsButton!: HTMLButtonElement;

  constructor(
    private yasgui: Yasgui,
    private assistant: AiAssistant,
  ) {
    this.rootEl = el("div", "yasgui-ai");
    this.rootEl.setAttribute("aria-label", "AI assistant");

    this.statusEl = el("div", "yasgui-ai__status");
    this.rootEl.appendChild(this.statusEl);

    this.actionsEl = el("div", "yasgui-ai__actions");
    this.actionsEl.setAttribute("role", "group");
    this.actionsEl.setAttribute("aria-label", "AI actions");
    this.explainButton = button(
      "Explain query",
      "yasgui-ai__action",
      "Explain the query in the editor in plain language",
    );
    this.explainButton.addEventListener("click", () => this.runAction("explainQuery"));
    this.fixButton = button(
      "Fix query",
      "yasgui-ai__action",
      "Find out why the query fails, and get a corrected query",
    );
    this.fixButton.addEventListener("click", () => this.runAction("fix"));
    this.resultsButton = button("Explain results", "yasgui-ai__action");
    this.resultsButton.addEventListener("click", () => this.runAction("explainResults"));
    this.actionsEl.append(this.explainButton, this.fixButton, this.resultsButton);
    this.rootEl.appendChild(this.actionsEl);

    this.logEl = el("div", "yasgui-ai__log");
    this.logEl.setAttribute("aria-live", "polite");
    this.rootEl.appendChild(this.logEl);

    const composer = el("form", "yasgui-ai__composer");
    this.inputEl = el("textarea", "yasgui-ai__input");
    this.inputEl.rows = 3;
    this.inputEl.placeholder = "Ask about the data, or describe the query you need…";
    this.inputEl.setAttribute("aria-label", "Question for the AI assistant");
    this.inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        composer.requestSubmit();
      }
    });
    const composerFooter = el("div", "yasgui-ai__composerFooter");
    const hint = el("span", "yasgui-ai__hint", "Enter to send, Shift+Enter for a new line");
    this.sendButton = button("Send", "yasgui-ai__send");
    this.sendButton.type = "submit";
    composerFooter.append(hint, this.sendButton);
    composer.append(this.inputEl, composerFooter);
    composer.addEventListener("submit", (event) => {
      event.preventDefault();
      this.ask();
    });
    this.rootEl.appendChild(composer);

    const container = yasgui.sidePanel.addView("assistant", "AI", "sparkles");
    container.appendChild(this.rootEl);
    yasgui.sidePanel.onChange(() => this.refresh());
    yasgui.on("tabSelect", () => this.refresh());
    yasgui.on("queryResponse", () => this.refresh());
    // A syntax error found while typing enables "Fix query" (tabChange follows when the editor loses focus)
    yasgui.on("tabChange", () => this.refresh());
    this.refresh();
  }

  public getElement() {
    return this.rootEl;
  }

  public open() {
    this.yasgui.sidePanel.show("assistant");
  }

  /** Show the AI view, or close the panel when it is already showing it */
  public toggle() {
    this.yasgui.sidePanel.toggle("assistant");
    if (this.yasgui.sidePanel.isViewVisible("assistant")) setTimeout(() => this.inputEl.focus(), 0);
  }

  /** Open the panel with the question box focused */
  public focusQuestion() {
    this.open();
    setTimeout(() => this.inputEl.focus(), 0);
  }

  public clear() {
    this.logEl.innerHTML = "";
    this.renderIntro();
  }

  private runAction(kind: "explainQuery" | "fix" | "explainResults") {
    void this.assistant.run(this.assistant.createTask(kind));
  }

  private ask() {
    const question = this.inputEl.value.trim();
    if (!question || this.assistant.isBusy()) return;
    this.inputEl.value = "";
    void this.assistant.run(this.assistant.createTask("ask", { question }));
  }

  /** Update the status line and the quick actions for the active tab */
  public refresh() {
    const connection = this.assistant.getConnection();
    this.statusEl.innerHTML = "";
    const dot = el("span", `yasgui-ai__dot ${connection ? "connected" : ""}`);
    const describe = (candidate: AiConnection) =>
      candidate.kind === "proxy"
        ? `Answers come from ${candidate.label} (${candidate.host}), the AI service of this site`
        : `Answers come from ${candidate.host}${candidate.apiKey ? ", with your own API key" : ""}`;
    const connections = this.assistant.getConnections();
    let text: HTMLElement;
    if (connections.length) {
      // Pick the service for the next questions; the default is set in the settings
      const select = el("select", "yasgui-ai__statusText yasgui-ai__serviceSelect");
      select.setAttribute("aria-label", "AI service");
      for (const candidate of connections) {
        const option = el(
          "option",
          undefined,
          candidate.model ? `${candidate.label} · ${candidate.model}` : candidate.label,
        );
        option.value = candidate.id;
        select.appendChild(option);
      }
      const off = el("option", undefined, "No AI service: copy a prompt");
      off.value = AI_SERVICE_OFF;
      select.appendChild(off);
      select.value = connection?.id || AI_SERVICE_OFF;
      select.title = connection ? describe(connection) : "The actions copy a prompt for an AI chat of your choice";
      select.addEventListener("change", () => this.assistant.selectService(select.value));
      text = select;
    } else {
      text = el("span", "yasgui-ai__statusText", "No AI service: actions copy a prompt");
      text.title = "Set up an AI service in the settings to get answers here";
    }
    const settings = iconButton("settings", "AI settings", { className: "yasgui-ai__iconButton", size: 16 });
    settings.addEventListener("click", () => this.yasgui.getTab()?.openSettings("ai"));
    const reset = iconButton("plus", "New conversation", { className: "yasgui-ai__iconButton", size: 16 });
    reset.addEventListener("click", () => this.assistant.newConversation());
    this.statusEl.append(dot, text, reset, settings);

    const error = this.assistant.getQueryError();
    this.fixButton.textContent = error?.source === "noResults" ? "Why no results?" : "Fix query";
    this.fixButton.disabled = !error;
    this.fixButton.title = error
      ? error.source === "noResults"
        ? "Find out why the query returns no results"
        : "Find out why the query fails, and get a corrected query"
      : "Available when the query has an error or no results";
    const hasResults = this.assistant.hasResults();
    this.resultsButton.disabled = !hasResults;
    this.resultsButton.title = hasResults
      ? `Summarise the results (sends at most ${this.assistant.config.maxResultRows} rows)`
      : "Run a query first";
    const busy = this.assistant.isBusy();
    this.sendButton.disabled = busy;
    this.sendButton.textContent = connection ? "Send" : "Copy prompt";
    this.sendButton.title = connection ? "Send the question" : "Copy the question as a prompt for an AI chat";
    this.rootEl.classList.toggle("connected", !!connection);
    // The intro depends on whether a service is set up
    if (!this.logEl.childElementCount || this.logEl.querySelector(".yasgui-ai__intro")) {
      this.logEl.innerHTML = "";
      this.renderIntro();
    }
  }

  private renderIntro() {
    const intro = el("div", "yasgui-ai__intro");
    const connection = this.assistant.getConnection();
    intro.appendChild(
      el(
        "p",
        undefined,
        "Ask a question in your own words and get a SPARQL query, or let the assistant explain or fix the query in the editor and explain its results.",
      ),
    );
    if (connection) {
      intro.appendChild(
        el(
          "p",
          undefined,
          `Nothing is sent until you ask. Before the first request you see what is sent to ${connection.label}.`,
        ),
      );
    } else {
      intro.appendChild(
        el(
          "p",
          undefined,
          "No AI service is set up, so the actions copy a ready-made prompt that you can paste in ChatGPT, Claude, Le Chat or any other AI chat.",
        ),
      );
      if (this.assistant.config.allowOwnKey || this.assistant.config.proxy) {
        const setup = button("Set up an AI service", "yasgui-ai__link");
        setup.addEventListener("click", () => this.yasgui.getTab()?.openSettings("ai"));
        intro.appendChild(setup);
      }
    }
    intro.appendChild(el("p", "yasgui-ai__note", "AI answers can be wrong. Check a query before you rely on it."));
    this.logEl.appendChild(intro);
  }

  private removeIntro() {
    this.logEl.querySelector(".yasgui-ai__intro")?.remove();
  }

  private addQuestionCard(task: AiTask) {
    this.removeIntro();
    const card = el("div", "yasgui-ai__question");
    card.appendChild(el("div", "yasgui-ai__questionTitle", task.title));
    if (task.kind === "ask" && task.question) card.appendChild(el("div", "yasgui-ai__questionText", task.question));
    this.logEl.appendChild(card);
    this.scrollToEnd();
  }

  private scrollToEnd() {
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  public showNotice(message: string) {
    this.open();
    this.removeIntro();
    this.logEl.appendChild(el("div", "yasgui-ai__notice", message));
    this.scrollToEnd();
  }

  private includesList(includes: string[]): HTMLUListElement {
    const list = el("ul", "yasgui-ai__includes");
    for (const item of includes) list.appendChild(el("li", undefined, item));
    return list;
  }

  /**
   * Privacy notice before the first request to a service: what is sent, to whom, and what is never sent.
   */
  public askConsent(
    task: AiTask,
    connection: AiConnection,
    includes: string[],
  ): Promise<{ send: boolean; remember: boolean }> {
    this.open();
    this.addQuestionCard(task);
    const card = el("div", "yasgui-ai__consent");
    card.setAttribute("role", "group");
    card.setAttribute("aria-label", "Send to the AI service?");
    const heading = el("div", "yasgui-ai__consentTitle");
    heading.innerHTML = icon("lock", 16);
    heading.appendChild(el("span", undefined, `Send to ${connection.label}?`));
    card.appendChild(heading);
    const to =
      connection.kind === "proxy"
        ? `This request goes to ${connection.label} (${connection.host}), the AI service of this site. It includes:`
        : `This request goes from your browser to ${connection.host} with your own API key. It includes:`;
    card.appendChild(el("p", undefined, to));
    card.appendChild(this.includesList(includes));
    const never =
      task.kind === "explainResults"
        ? "Never sent: your endpoint credentials and the other tabs."
        : "Never sent: result data, your endpoint credentials and the other tabs.";
    card.appendChild(el("p", "yasgui-ai__muted", never));
    if (this.assistant.checkQueriesEnabled()) {
      card.appendChild(
        el(
          "p",
          "yasgui-ai__muted",
          "The assistant may run small read-only check queries on the endpoint; their results (at most 20 rows each) are sent too. You see each one in the answer.",
        ),
      );
    }
    if (connection.privacyUrl) {
      const link = el("a", "yasgui-ai__privacyLink", "Privacy policy of the service");
      link.href = connection.privacyUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      card.appendChild(link);
    }
    const rememberLabel = el("label", "yasgui-ai__remember");
    const remember = el("input");
    remember.type = "checkbox";
    rememberLabel.append(remember, document.createTextNode(` Don't ask again for ${connection.host}`));
    card.appendChild(rememberLabel);
    const buttons = el("div", "yasgui-ai__buttons");
    const send = button("Send", "yasgui-ai__primary");
    const cancel = button("Cancel", "yasgui-ai__secondary");
    buttons.append(send, cancel);
    card.appendChild(buttons);
    this.logEl.appendChild(card);
    this.scrollToEnd();
    send.focus();
    return new Promise((resolve) => {
      const done = (answer: boolean) => {
        // Collapse to one line; the answer repeats what was sent under "What was sent"
        card.classList.add("answered");
        card.innerHTML = "";
        const line = el("div", "yasgui-ai__consentTitle");
        line.innerHTML = icon("lock", 14);
        line.appendChild(el("span", undefined, answer ? `Sent to ${connection.label}` : "Not sent"));
        card.appendChild(line);
        resolve({ send: answer, remember: remember.checked });
      };
      send.addEventListener("click", () => done(true));
      cancel.addEventListener("click", () => done(false));
    });
  }

  /** Shows the prompt that "Copy for AI" put on the clipboard */
  public showCopied(task: AiTask, prompt: string, copied: boolean) {
    this.open();
    this.addQuestionCard(task);
    const card = el("div", "yasgui-ai__answer yasgui-ai__copied");
    card.appendChild(
      el(
        "p",
        undefined,
        copied
          ? "Prompt copied. Paste it in the AI chat of your choice; nothing was sent from MatGUI."
          : "The browser didn't allow copying. Select the prompt below and copy it yourself.",
      ),
    );
    const details = el("details", "yasgui-ai__sent");
    details.open = !copied;
    details.appendChild(el("summary", undefined, "Show the prompt"));
    const pre = el("pre", "yasgui-ai__sentText", prompt);
    details.appendChild(pre);
    card.appendChild(details);
    if (!this.assistant.isConnected() && (this.assistant.config.allowOwnKey || this.assistant.config.proxy)) {
      const setup = button("Get answers here instead", "yasgui-ai__link");
      setup.addEventListener("click", () => this.yasgui.getTab()?.openSettings("ai"));
      card.appendChild(setup);
    }
    this.logEl.appendChild(card);
    this.scrollToEnd();
  }

  /** Card of an answer that is being generated */
  public startAnswer(task: AiTask, includes: string[], connection: AiConnection): AnswerView {
    this.open();
    if (!this.logEl.lastElementChild?.classList.contains("yasgui-ai__consent")) this.addQuestionCard(task);
    const card = el("div", "yasgui-ai__answer loading");
    const progress = el("div", "yasgui-ai__progress");
    progress.innerHTML = icon("loader", 16);
    progress.appendChild(el("span", undefined, `Asking ${connection.label}…`));
    const cancel = button("Stop", "yasgui-ai__secondary yasgui-ai__stop");
    progress.appendChild(cancel);
    card.appendChild(progress);
    const checks = el("div", "yasgui-ai__checks");
    card.appendChild(checks);
    const body = el("div", "yasgui-ai__body");
    card.appendChild(body);
    const footer = el("div", "yasgui-ai__footer");
    card.appendChild(footer);
    this.logEl.appendChild(card);
    this.scrollToEnd();
    this.refresh();

    let cancelListener: (() => void) | undefined;
    cancel.addEventListener("click", () => cancelListener?.());
    const finish = () => {
      card.classList.remove("loading");
      progress.remove();
    };
    let sentText = "";
    const renderFooter = (meta?: AnswerMeta) => {
      footer.innerHTML = "";
      if (meta) {
        const bits = [meta.connection.label];
        if (meta.model) bits.push(meta.model);
        if (meta.totalTokens) bits.push(`${meta.totalTokens.toLocaleString()} tokens`);
        footer.appendChild(el("div", "yasgui-ai__meta", `AI generated · ${bits.join(" · ")}`));
      }
      if (sentText) {
        const details = el("details", "yasgui-ai__sent");
        const summary = el("summary", undefined, "What was sent");
        details.appendChild(summary);
        details.appendChild(this.includesList(includes));
        details.appendChild(el("pre", "yasgui-ai__sentText", sentText));
        footer.appendChild(details);
      }
    };

    return {
      onCancel: (listener) => (cancelListener = listener),
      addCheckQuery: (report) => {
        const details = el("details", `yasgui-ai__check ${report.error ? "failed" : ""}`);
        const summary = el("summary");
        summary.innerHTML = icon("database", 14);
        summary.appendChild(
          el(
            "span",
            undefined,
            `Check query${report.purpose ? `: ${report.purpose}` : ""}${report.error ? " (failed)" : ""}`,
          ),
        );
        details.appendChild(summary);
        details.appendChild(el("pre", "yasgui-ai__code", report.query));
        details.appendChild(el("pre", "yasgui-ai__checkResult", report.error || report.result || ""));
        checks.appendChild(details);
        this.scrollToEnd();
      },
      setAnswer: (markdown, meta) => {
        finish();
        body.innerHTML = "";
        body.appendChild(
          renderMarkdown(markdown || "(The AI service sent an empty answer.)", (code, lang) =>
            this.renderCode(code, lang),
          ),
        );
        if (!extractQueries(markdown).length && task.kind === "fix") {
          body.appendChild(el("p", "yasgui-ai__muted", "The answer holds no corrected query."));
        }
        const copyAnswer = button("Copy answer", "yasgui-ai__link");
        copyAnswer.addEventListener("click", () => {
          void navigator.clipboard?.writeText(markdown).then(() => (copyAnswer.textContent = "Copied"));
        });
        renderFooter(meta);
        footer.appendChild(copyAnswer);
        this.scrollToEnd();
      },
      setError: (message) => {
        finish();
        card.classList.add("error");
        body.innerHTML = "";
        body.appendChild(el("p", "yasgui-ai__errorText", message));
        const settings = button("Open AI settings", "yasgui-ai__link");
        settings.addEventListener("click", () => this.yasgui.getTab()?.openSettings("ai"));
        body.appendChild(settings);
        renderFooter();
        this.scrollToEnd();
      },
      setCancelled: () => {
        finish();
        body.appendChild(el("p", "yasgui-ai__muted", "Stopped."));
      },
      setSent: (messages) => {
        sentText = formatSentMessages(messages);
      },
    };
  }

  /** Code block of an answer; SPARQL gets buttons to use it in the editor */
  private renderCode(code: string, lang: string): HTMLElement {
    const wrapper = el("div", "yasgui-ai__codeBlock");
    wrapper.appendChild(el("pre", "yasgui-ai__code", code));
    const isSparql = lang === "sparql" || lang === "rq" || (!lang && looksLikeSparql(code));
    const actions = el("div", "yasgui-ai__codeActions");
    if (isSparql) {
      const replace = button(
        "Use in editor",
        "yasgui-ai__codeButton yasgui-ai__primary",
        "Replace the query in the editor (Ctrl+Z undoes it)",
      );
      replace.addEventListener("click", () => {
        const yasqe = this.yasgui.getTab()?.getYasqe();
        if (!yasqe) return;
        yasqe.setValue(code);
        yasqe.focus();
        replace.textContent = "Done";
      });
      const insert = button("Insert", "yasgui-ai__codeButton", "Insert at the cursor");
      insert.addEventListener("click", () => {
        const yasqe = this.yasgui.getTab()?.getYasqe();
        if (!yasqe) return;
        yasqe.replaceSelection(code);
        yasqe.focus();
      });
      const newTab = button("New tab", "yasgui-ai__codeButton", "Open the query in a new tab");
      newTab.addEventListener("click", () => {
        const current = this.yasgui.getTab();
        const tab = this.yasgui.addTab(
          true,
          current ? { requestConfig: { ...current.getRequestConfig(), endpoint: current.getEndpoint() } } : undefined,
        );
        tab.setQuery(code);
      });
      actions.append(replace, insert, newTab);
    }
    const copy = button("Copy", "yasgui-ai__codeButton");
    copy.addEventListener("click", () => {
      void navigator.clipboard?.writeText(code).then(() => (copy.textContent = "Copied"));
    });
    actions.appendChild(copy);
    wrapper.appendChild(actions);
    return wrapper;
  }

  public destroy() {
    this.rootEl.remove();
  }
}
