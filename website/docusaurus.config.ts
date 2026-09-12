import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "MatGUI",
  tagline: "A modern knowledge graph and SPARQL workbench",
  favicon: "img/favicon.svg",

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: "https://matgui-docs.matdata.eu",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "Matdata-eu", // Usually your GitHub org/user name.
  projectName: "MatGUI", // Usually your repo name.

  onBrokenLinks: "throw",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "docs",
          editUrl: "https://github.com/Matdata-eu/Matgui/tree/main/website/",
        },
        blog: false, // Disable blog for now
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: "img/docusaurus-social-card.jpg",
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "MatGUI",
      logo: {
        alt: "MatGUI Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Documentation",
        },
        {
          href: "https://matgui.matdata.eu/",
          label: "Live Demo",
          position: "left",
        },
        {
          href: "https://github.com/Matdata-eu/Matgui",
          label: "GitHub",
          position: "right",
        },
        {
          href: "https://www.npmjs.com/package/@matdata/matgui",
          label: "npm",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Documentation",
          items: [
            {
              label: "User Guide",
              to: "/docs/user-guide",
            },
            {
              label: "Developer Guide",
              to: "/docs/developer-guide",
            },
          ],
        },
        {
          title: "Resources",
          items: [
            {
              label: "Live Demo",
              href: "https://matgui.matdata.eu/",
            },
            {
              label: "npm Package",
              href: "https://www.npmjs.com/package/@matdata/yasgui",
            },
            {
              label: "Docker Hub",
              href: "https://hub.docker.com/r/mathiasvda/yasgui",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/Matdata-eu/Yasgui",
            },
            {
              label: "Releases",
              href: "https://github.com/Matdata-eu/Matgui/releases",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} MatGUI Contributors. Licensed under MIT. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
