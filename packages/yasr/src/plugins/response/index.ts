/**
 * Make sure not to include any deps from our main index file. That way, we can easily publish the publin as standalone build
 */
import { Plugin } from "../";
import Yasr from "../../";
import "./index.scss";
import { EditorState, Extension } from "@codemirror/state";
import { EditorView, lineNumbers, highlightSpecialChars } from "@codemirror/view";
import { foldGutter, bracketMatching, syntaxHighlighting, StreamLanguage } from "@codemirror/language";
import { classHighlighter } from "@lezer/highlight";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { javascript } from "@codemirror/legacy-modes/mode/javascript";
import { addClass, removeClass } from "@matdata/yasgui-utils";
import { DeepReadonly } from "ts-essentials";

export interface PluginConfig {
  maxLines: number;
}
export default class Response implements Plugin<PluginConfig> {
  private yasr: Yasr;
  label = "Response";
  priority = 2;
  helpReference = "https://yasgui-doc.matdata.eu/docs/user-guide#response-plugin";
  private config: DeepReadonly<PluginConfig>;
  private overLay: HTMLDivElement | undefined;
  private cm: EditorView | undefined;
  constructor(yasr: Yasr) {
    this.yasr = yasr;
    this.config = Response.defaults;
    if (yasr.config.plugins["response"] && yasr.config.plugins["response"].dynamicConfig) {
      this.config = {
        ...this.config,
        ...yasr.config.plugins["response"].dynamicConfig,
      };
    }
  }
  // getDownloadInfo: getDownloadInfo
  canHandleResults() {
    if (!this.yasr.results) return false;
    if (!this.yasr.results.getOriginalResponseAsString) return false;
    var response = this.yasr.results.getOriginalResponseAsString();
    if ((!response || response.length == 0) && this.yasr.results.getError()) return false; //in this case, show exception instead, as we have nothing to show anyway
    return true;
  }
  public getIcon() {
    const icon = document.createElement("i");
    icon.className = "fas fa-align-left";
    return icon;
  }
  download(filename?: string) {
    if (!this.yasr.results) return;
    const contentType = this.yasr.results.getContentType();
    const type = this.yasr.results.getType();
    const extension = type === "xml" ? "rdf" : type;
    return {
      getData: () => {
        return this.yasr.results?.getOriginalResponseAsString() || "";
      },
      filename: `${filename || "queryResults"}${extension ? "." + extension : ""}`,
      contentType: contentType ? contentType : "text/plain",
      title: "Download result",
    };
  }
  draw(persistentConfig: PluginConfig) {
    const config: DeepReadonly<PluginConfig> = {
      ...this.config,
      ...persistentConfig,
    };
    // When the original response is empty, use an empty string
    let value = this.yasr.results?.getOriginalResponseAsString() || "";
    const lines = value.split("\n");
    if (lines.length > config.maxLines) {
      value = lines.slice(0, config.maxLines).join("\n");
    }

    // Detect current theme from document
    const isDarkTheme = document.documentElement.getAttribute("data-theme") === "dark";

    const extensions: Extension[] = [
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      lineNumbers(),
      foldGutter(),
      highlightSpecialChars(),
      bracketMatching(),
      EditorView.lineWrapping,
      // Emit stable `tok-*` classes so the theme SCSS controls colors (light & dark)
      syntaxHighlighting(classHighlighter),
      EditorView.editorAttributes.of({ class: `CodeMirror cm-s-${isDarkTheme ? "yasgui-dark" : "default"}` }),
    ];
    const language = this.getLanguageExtension();
    if (language) extensions.push(language);

    this.destroyEditor();
    this.cm = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: this.yasr.resultsEl,
    });
    // Don't show less originally we've already set the value in the editor state
    if (lines.length > config.maxLines) this.showLess(false);
  }
  private getLanguageExtension(): Extension | undefined {
    const type = this.yasr.results?.getType();
    if (type === "json") return json();
    if (type === "xml") return xml();
    const contentType = this.yasr.results?.getContentType() || "";
    if (contentType.indexOf("json") >= 0) return json();
    if (contentType.indexOf("xml") >= 0 || contentType.indexOf("html") >= 0) return xml();
    if (contentType.indexOf("javascript") >= 0) return StreamLanguage.define(javascript);
    return undefined;
  }
  private destroyEditor() {
    if (this.cm) {
      this.cm.destroy();
      this.cm = undefined;
    }
    this.overLay?.remove();
    this.overLay = undefined;
  }
  private setValue(value: string) {
    if (!this.cm) return;
    this.cm.dispatch({ changes: { from: 0, to: this.cm.state.doc.length, insert: value } });
  }
  private limitData(value: string) {
    const lines = value.split("\n");
    if (lines.length > this.config.maxLines) {
      value = lines.slice(0, this.config.maxLines).join("\n");
    }
    return value;
  }
  /**
   *
   * @param setValue Optional, if set to false the string will not update
   */
  showLess(setValue = true) {
    if (!this.cm) return;
    // Add overflow
    addClass(this.cm.dom, "overflow");

    // Remove old instance
    if (this.overLay) {
      this.overLay.remove();
      this.overLay = undefined;
    }

    // Wrapper
    this.overLay = document.createElement("div");
    addClass(this.overLay, "overlay");

    // overlay content
    const overlayContent = document.createElement("div");
    addClass(overlayContent, "overlay_content");

    const showMoreButton = document.createElement("button");
    showMoreButton.title = "Show all";
    addClass(showMoreButton, "yasr_btn", "overlay_btn");
    showMoreButton.textContent = "Show all";
    showMoreButton.addEventListener("click", () => this.showMore());
    overlayContent.append(showMoreButton);

    const downloadButton = document.createElement("button");
    downloadButton.title = "Download result";
    addClass(downloadButton, "yasr_btn", "overlay_btn");

    const text = document.createElement("span");
    text.innerText = "Download result";
    downloadButton.appendChild(text);
    const downloadIcon = document.createElement("i");
    addClass(downloadIcon, "fas");
    addClass(downloadIcon, "fa-download");
    downloadButton.appendChild(downloadIcon);
    downloadButton.addEventListener("click", () => this.yasr.download());
    downloadButton.addEventListener("keydown", (event) => {
      if (event.code === "Space" || event.code === "Enter") this.yasr.download();
    });

    overlayContent.appendChild(downloadButton);
    this.overLay.appendChild(overlayContent);
    this.cm.dom.appendChild(this.overLay);
    if (setValue) {
      this.setValue(this.limitData(this.yasr.results?.getOriginalResponseAsString() || ""));
    }
  }
  /**
   * Render the raw response full length
   */
  showMore() {
    if (!this.cm) return;
    removeClass(this.cm.dom, "overflow");
    this.overLay?.remove();
    this.overLay = undefined;
    this.setValue(this.yasr.results?.getOriginalResponseAsString() || "");
  }
  destroy() {
    this.destroyEditor();
  }
  public static defaults: PluginConfig = {
    maxLines: 30,
  };
}
