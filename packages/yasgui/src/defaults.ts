import { Config } from "./";
import Yasr from "@matdata/yasr";
import { default as Yasqe } from "@matdata/yasqe";
import { CatalogueItem } from "./endpointSelect";

export default function initialize(): Config<CatalogueItem> {
  return {
    autofocus: true,
    endpointInfo: undefined,
    persistenceId: function (yasgui) {
      //Traverse parents untl we've got an id
      // Get matching parent elements
      var id = "";
      var elem: any = yasgui.rootEl;
      if ((<any>elem).id) id = (<any>elem).id;
      for (; elem && elem !== <any>document; elem = elem.parentNode) {
        if (elem) {
          if ((<any>elem).id) id = (<any>elem).id;
          break;
        }
      }
      return "yagui_" + id;
    },
    tabName: "Query",
    persistencyExpire: 60 * 60 * 24 * 30,
    persistenceLabelResponse: "response",
    persistenceLabelConfig: "config",
    yasqe: Yasqe.defaults,
    yasr: Yasr.defaults,
    theme: undefined,
    showThemeToggle: true,
    orientation: "vertical",
    showSnippetsBar: true,
    endpointDescribe: {
      enabled: true,
      timeoutMs: 60000,
      maxConcurrentQueries: 2,
      fetchMetadata: true,
    },
    endpointButtons: undefined,
    endpointCatalogueOptions: {
      getData: () => {
        return [
          {
            endpoint: "https://dbpedia.org/sparql",
          },
          {
            endpoint: "https://query.wikidata.org/bigdata/namespace/wdq/sparql",
          },
        ];
      },
      keys: [],
      renderItem: (data, source) => {
        const contentDiv = document.createElement("div");

        contentDiv.style.display = "flex";
        contentDiv.style.flexDirection = "column";
        const endpointSpan = document.createElement("span");
        endpointSpan.innerHTML =
          data.matches.endpoint?.reduce(
            (current, object) => (object.highlight ? current + object.text.bold() : current + object.text),
            "",
          ) || "";
        contentDiv.appendChild(endpointSpan);
        source.appendChild(contentDiv);
      },
    },
    copyEndpointOnNewTab: true,
    populateFromUrl: true,
    autoAddOnInit: true,
    requestConfig: Yasqe.defaults.requestConfig,
    contextMenuContainer: undefined,
  };
}
