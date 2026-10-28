import { Storage as YStorage } from "@matdata/yasgui-utils";
import PersistentConfig from "./PersistentConfig";

export type Theme = "light" | "dark";

export class ThemeManager {
  private static STORAGE_KEY = "yasgui_theme";
  private storage: YStorage;
  private currentTheme: Theme;
  private rootElement: HTMLElement;
  private persistentConfig?: PersistentConfig;

  constructor(rootElement: HTMLElement) {
    this.storage = new YStorage("yasgui");
    this.rootElement = rootElement;
    this.currentTheme = this.getStoredTheme() || this.getSystemTheme();
    this.applyTheme(this.currentTheme);
  }

  /**
   * Set PersistentConfig for accessing CodeMirror theme preference
   */
  public setPersistentConfig(persistentConfig: PersistentConfig): void {
    this.persistentConfig = persistentConfig;
  }

  /**
   * Get the currently active theme
   */
  public getTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * Set and apply a new theme
   */
  public setTheme(theme: Theme): void {
    this.currentTheme = theme;
    this.applyTheme(theme);
    // Store theme preference with 1 year expiration
    this.storage.set(ThemeManager.STORAGE_KEY, theme, 60 * 60 * 24 * 365, () => {
      console.warn("Failed to store theme preference due to quota exceeded");
    });
  }

  /** "light" or "dark" when the user picked one, "system" when the theme follows the operating system */
  public getPreference(): Theme | "system" {
    return this.getStoredTheme() || "system";
  }

  /** Forget the theme the user picked and follow the operating system again */
  public followSystem(): void {
    this.storage.remove(ThemeManager.STORAGE_KEY);
    this.currentTheme = this.getSystemTheme();
    this.applyTheme(this.currentTheme);
  }

  /**
   * Toggle between light and dark themes
   */
  public toggleTheme(): Theme {
    const newTheme = this.currentTheme === "light" ? "dark" : "light";
    this.setTheme(newTheme);
    return newTheme;
  }

  /**
   * Apply theme to the DOM
   */
  private applyTheme(theme: Theme): void {
    // Set data-theme attribute on root element
    this.rootElement.setAttribute("data-theme", theme);

    // Also set on document root for global styles
    document.documentElement.setAttribute("data-theme", theme);

    // Update Yasqe CodeMirror theme
    this.updateCodeMirrorTheme(theme);
  }

  /**
   * Update CodeMirror theme for all Yasqe editors
   */
  private updateCodeMirrorTheme(theme: Theme): void {
    // Get user's stored CodeMirror theme preference for the current mode, or use default
    let cmTheme: string;
    if (this.persistentConfig) {
      const storedTheme = this.persistentConfig.getCodeMirrorTheme(theme);
      cmTheme = storedTheme || (theme === "dark" ? "github-dark" : "default");
    } else {
      // Fallback if persistentConfig not yet available
      cmTheme = theme === "dark" ? "github-dark" : "default";
    }

    // Find all CodeMirror instances within the root element
    const cmElements = this.rootElement.querySelectorAll(".CodeMirror");
    cmElements.forEach((element) => {
      const cm = (element as any).CodeMirror;
      if (cm && cm.setOption) {
        cm.setOption("theme", cmTheme);
      }
    });
  }

  /**
   * Get theme from localStorage
   */
  private getStoredTheme(): Theme | null {
    const stored = this.storage.get<Theme>(ThemeManager.STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    return null;
  }

  /**
   * Detect system theme preference
   */
  private getSystemTheme(): Theme {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  /**
   * Listen for system theme changes
   */
  public listenToSystemTheme(): void {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", (e) => {
        // Only update if user hasn't manually set a theme
        if (!this.storage.get(ThemeManager.STORAGE_KEY)) {
          const newTheme = e.matches ? "dark" : "light";
          this.currentTheme = newTheme;
          this.applyTheme(newTheme);
        }
      });
    }
  }

  /**
   * Refresh theme application (useful after new content is loaded)
   */
  public refresh(): void {
    this.applyTheme(this.currentTheme);
  }
}
