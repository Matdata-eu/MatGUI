// Footer toggle functionality for small screens
(function () {
  const footer = document.getElementById("footer");
  const footerToggle = document.getElementById("footer-toggle");

  if (!footer || !footerToggle) return;

  // Toggle footer visibility
  footerToggle.addEventListener("click", function () {
    footer.classList.toggle("expanded");
    footerToggle.classList.toggle("hidden");
  });

  // Close footer when clicking outside
  document.addEventListener("click", function (event) {
    const isClickInsideFooter = footer.contains(event.target);
    const isClickOnToggle = footerToggle.contains(event.target);

    // Only close if footer is expanded, click is outside, and not on toggle button
    if (footer.classList.contains("expanded") && !isClickInsideFooter && !isClickOnToggle) {
      footer.classList.remove("expanded");
      footerToggle.classList.remove("hidden");
    }
  });
})();

// Function to sync theme with body
function syncThemeWithBody() {
  const theme = document.documentElement.getAttribute("data-theme") || "light";
  document.body.setAttribute("data-theme", theme);
}

// Matgui is loaded via CDN in index.html and available as a global variable
if (typeof Yasgui !== "undefined") {
  const yasgui = new Yasgui(document.getElementById("yasgui"), {
    // Set the SPARQL endpoint
    requestConfig: {
      endpoint: "https://change.to.default.endpoint/sparql",
    },

    // Allow resizing of the Yasqe editor
    resizeable: true,

    // Whether to autofocus on Yasqe on page load
    autofocus: true,

    // Use the default endpoint when a new tab is opened
    copyEndpointOnNewTab: true,

    // Configuring which endpoints appear in the endpoint catalogue list
    endpointCatalogueOptions: {
      getData: () => {
        return [
          //List of objects should contain the endpoint field
          //Feel free to include any other fields (e.g. a description or icon
          //that you'd like to use when rendering)
          {
            endpoint: "https://graph.data.era.europa.eu/repositories/rinf-plus",
          },
          {
            endpoint: "https://dbpedia.org/sparql",
          },
          {
            endpoint: "https://query.wikidata.org",
          },
          // ...
        ];
      },
      //Data object keys that are used for filtering. The 'endpoint' key already used by default
      keys: [],
      //Data argument contains a `value` property for the matched data object
      //Source argument is the suggestion DOM element to append your rendered item to
      renderItem: (data, source) => {
        const contentDiv = document.createElement("div");
        contentDiv.innerText = data.value.endpoint;
        source.appendChild(contentDiv);
      },
    },

    yasqe: {
      snippets: [
        { label: "SELECT", code: "SELECT * WHERE {\n  ?s ?p ?o .\n} LIMIT 10", group: "QUERY" },
        { label: "CONSTRUCT", code: "CONSTRUCT {\n  ?s ?p ?o .\n} WHERE {\n  ?s ?p ?o .\n} LIMIT 10", group: "QUERY" },
        { label: "ASK", code: "ASK {\n  ?s ?p ?o .\n}", group: "QUERY" },
        { label: "DESCRIBE", code: "DESCRIBE ?s", group: "QUERY" },
        {
          label: "UPDATE",
          code: 'DELETE {\n  ?s ex:oldProperty ?oldValue .\n}\nINSERT {\n  ?s ex:newProperty ?newValue .\n}\nWHERE {\n  ?s ex:oldProperty ?oldValue .\n  BIND(CONCAT(?oldValue, " updated") AS ?newValue)\n}',
          group: "QUERY",
        },
        { label: "UPDATE DATA", code: 'INSERT DATA {\n  ex:subject ex:property "new value" .\n}', group: "QUERY" },
        { label: "PREDICATE PATH", code: "?subject ex:property ?object", group: "PATH" },
        { label: "INVERSE PATH", code: "?subject ^ex:property ?object", group: "PATH" },
        { label: "SEQUENCE PATH", code: "?subject ex:property1/ex:property2 ?object", group: "PATH" },
        { label: "ALTERNATIVE PATH", code: "?subject ex:property1|ex:property2 ?object", group: "PATH" },
        { label: "ZERO OR MORE PATH", code: "?subject ex:property* ?object", group: "PATH" },
        { label: "ONE OR MORE PATH", code: "?subject ex:property+ ?object", group: "PATH" },
        { label: "ZERO OR ONE PATH", code: "?subject ex:property? ?object", group: "PATH" },
        { label: "NEGATED PROPERTY SET", code: "?subject !ex:property ?object", group: "PATH" },
        { label: "NEGATED PROPERTY SET (MULTI)", code: "?subject !(ex:property1|ex:property2) ?object", group: "PATH" },
        { label: "OPTIONAL", code: "OPTIONAL {\n  ?s ?p ?o .\n}", group: "PATTERN" },
        { label: "UNION", code: "{ ?s ?p ?o . } UNION { ?s ?p2 ?o2 . }", group: "PATTERN" },
        { label: "BIND", code: "BIND(?var AS ?newVar)", group: "PATTERN" },
        { label: "VALUES", code: "VALUES ?var { val1 val2 }", group: "PATTERN" },
        { label: "VALUES (MULTI)", code: "VALUES (?varA ?varB) { (valA1 valB1) (valA2 valB2) }", group: "PATTERN" },
        { label: "GRAPH", code: "GRAPH <http://example.org/graph> {\n  ?s ?p ?o .\n}", group: "DATASET" },
        { label: "GRAPH VARIABLE", code: "GRAPH ?g {\n  ?s ?p ?o .\n}", group: "DATASET" },
        {
          label: "FROM NAMED",
          code: "SELECT * FROM NAMED <http://example.org/graph> WHERE {\n  ?s ?p ?o .\n}",
          group: "DATASET",
        },
        { label: "EQUALS", code: 'FILTER (?var = "value")', group: "COMPARISON" },
        { label: "NOT EQUALS", code: 'FILTER (?var != "value")', group: "COMPARISON" },
        { label: "LESS THAN", code: "FILTER (?var < 100)", group: "COMPARISON" },
        { label: "LESS OR EQUAL", code: "FILTER (?var <= 100)", group: "COMPARISON" },
        { label: "GREATER THAN", code: "FILTER (?var > 100)", group: "COMPARISON" },
        { label: "GREATER OR EQUAL", code: "FILTER (?var >= 100)", group: "COMPARISON" },
        { label: "IN", code: 'FILTER (?var IN ("value1", "value2", "value3"))', group: "COMPARISON" },
        { label: "NOT IN", code: 'FILTER (?var NOT IN ("value1", "value2"))', group: "COMPARISON" },
        { label: "REGEX", code: 'FILTER REGEX(?var, "pattern", "i")', group: "STRING" },
        { label: "CONTAINS", code: 'FILTER CONTAINS(str(?var), "text")', group: "STRING" },
        { label: "STRSTARTS", code: 'FILTER (STRSTARTS(str(?var), "prefix"))', group: "STRING" },
        { label: "STRENDS", code: 'FILTER (STRENDS(str(?var), "suffix"))', group: "STRING" },
        { label: "LANG", code: 'FILTER (lang(?var) = "en")', group: "STRING" },
        { label: "LANGMATCHES", code: 'FILTER LANGMATCHES(lang(?var), "en")', group: "STRING" },
        { label: "STR", code: "BIND(STR(?uri) AS ?string)", group: "STRING" },
        { label: "STRLEN", code: "BIND(STRLEN(?string) AS ?length)", group: "STRING" },
        { label: "SUBSTR", code: "BIND(SUBSTR(?string, 1, 5) AS ?substring)", group: "STRING" },
        { label: "UCASE", code: "BIND(UCASE(?string) AS ?upper)", group: "STRING" },
        { label: "LCASE", code: "BIND(LCASE(?string) AS ?lower)", group: "STRING" },
        { label: "CONCAT", code: 'BIND(CONCAT(?string1, " ", ?string2) AS ?result)', group: "STRING" },
        { label: "REPLACE", code: 'BIND(REPLACE(?string, "old", "new") AS ?result)', group: "STRING" },
        { label: "STRBEFORE", code: 'BIND(STRBEFORE(?string, "delimiter") AS ?result)', group: "STRING" },
        { label: "STRAFTER", code: 'BIND(STRAFTER(?string, "delimiter") AS ?result)', group: "STRING" },
        { label: "ENCODE_FOR_URI", code: "BIND(ENCODE_FOR_URI(?string) AS ?encoded)", group: "STRING" },
        { label: "BOUND", code: "FILTER (BOUND(?var))", group: "CHECKS" },
        { label: "NOT BOUND", code: "FILTER (!BOUND(?var))", group: "CHECKS" },
        { label: "ISURI", code: "FILTER (ISURI(?var))", group: "CHECKS" },
        { label: "ISLITERAL", code: "FILTER (ISLITERAL(?var))", group: "CHECKS" },
        { label: "ISBLANK", code: "FILTER (ISBLANK(?var))", group: "CHECKS" },
        { label: "EXISTS", code: "FILTER EXISTS {?var a ex:Person}", group: "CHECKS" },
        { label: "LOGICAL AND/OR", code: "FILTER ((?var1 > 100 && ?var2 < 200) || ?var3 = 150)", group: "CHECKS" },
        { label: "IF", code: 'BIND(IF(?condition, "true value", "false value") AS ?result)', group: "CHECKS" },
        { label: "COALESCE", code: 'BIND(COALESCE(?var1, ?var2, "default") AS ?result)', group: "CHECKS" },
        { label: "ABS", code: "BIND(ABS(?number) AS ?absolute)", group: "NUMERIC" },
        { label: "ROUND", code: "BIND(ROUND(?number) AS ?rounded)", group: "NUMERIC" },
        { label: "CEIL", code: "BIND(CEIL(?number) AS ?ceiling)", group: "NUMERIC" },
        { label: "FLOOR", code: "BIND(FLOOR(?number) AS ?floor)", group: "NUMERIC" },
        { label: "RAND", code: "BIND(RAND() AS ?random)", group: "NUMERIC" },
        { label: "MIN", code: "SELECT (MIN(?var) AS ?minimum) WHERE { ?s ?p ?var }", group: "AGGREGATE" },
        { label: "MAX", code: "SELECT (MAX(?var) AS ?maximum) WHERE { ?s ?p ?var }", group: "AGGREGATE" },
        { label: "AVG", code: "SELECT (AVG(?var) AS ?average) WHERE { ?s ?p ?var }", group: "AGGREGATE" },
        { label: "SUM", code: "SELECT (SUM(?var) AS ?total) WHERE { ?s ?p ?var }", group: "AGGREGATE" },
        { label: "COUNT", code: "SELECT (COUNT(?var) AS ?count) WHERE { ?s ?p ?var }", group: "AGGREGATE" },
        { label: "STRDT STRING", code: 'BIND(STRDT("value", xsd:string) AS ?result)', group: "DATATYPE" },
        { label: "STRDT INTEGER", code: 'BIND(STRDT("42", xsd:integer) AS ?result)', group: "DATATYPE" },
        { label: "STRDT DECIMAL", code: 'BIND(STRDT("3.14", xsd:decimal) AS ?result)', group: "DATATYPE" },
        { label: "STRDT BOOLEAN", code: 'BIND(STRDT("true", xsd:boolean) AS ?result)', group: "DATATYPE" },
        { label: "STRDT DATE", code: 'BIND(STRDT("2024-01-01", xsd:date) AS ?result)', group: "DATATYPE" },
        {
          label: "STRDT DATETIME",
          code: 'BIND(STRDT("2024-01-01T12:00:00", xsd:dateTime) AS ?result)',
          group: "DATATYPE",
        },
        { label: "NOW", code: "BIND(NOW() AS ?currentDateTime)", group: "DATE/TIME" },
        { label: "YEAR", code: "BIND(YEAR(?date) AS ?year)", group: "DATE/TIME" },
        { label: "MONTH", code: "BIND(MONTH(?date) AS ?month)", group: "DATE/TIME" },
        { label: "DAY", code: "BIND(DAY(?date) AS ?day)", group: "DATE/TIME" },
        { label: "HOURS", code: "BIND(HOURS(?dateTime) AS ?hours)", group: "DATE/TIME" },
        { label: "MINUTES", code: "BIND(MINUTES(?dateTime) AS ?minutes)", group: "DATE/TIME" },
        { label: "SECONDS", code: "BIND(SECONDS(?dateTime) AS ?seconds)", group: "DATE/TIME" },
        { label: "TIMEZONE", code: "BIND(TIMEZONE(?dateTime) AS ?tz)", group: "DATE/TIME" },
        { label: "TZ", code: "BIND(TZ(?dateTime) AS ?timezoneString)", group: "DATE/TIME" },
        { label: "ORDER BY ASC", code: "ORDER BY asc(?var)", group: "MODIFIERS" },
        { label: "ORDER BY DESC", code: "ORDER BY desc(?var)", group: "MODIFIERS" },
        { label: "DISTINCT", code: "SELECT DISTINCT ?var WHERE {\n  ?s ?p ?var .\n}", group: "MODIFIERS" },
        { label: "LIMIT", code: "LIMIT 10", group: "MODIFIERS" },
        { label: "OFFSET", code: "OFFSET 10", group: "MODIFIERS" },
        { label: "GROUP BY", code: "GROUP BY ?var", group: "MODIFIERS" },
        { label: "HAVING", code: "HAVING (count(*)>1)", group: "MODIFIERS" },
      ],
    },
  });

  // Sync theme immediately after initialization
  syncThemeWithBody();

  // Watch for theme changes on document.documentElement
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
        syncThemeWithBody();
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}
