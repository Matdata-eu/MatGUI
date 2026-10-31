import store from "store";
export interface ItemWrapper<V = {}> {
  exp: number;
  val: V;
  namespace: string;
  time: number;
}

interface QuotaExceededError extends Error {
  quotaExceeded?: boolean;
}

/** Sweeping expired keys parses every value in localStorage, so do it at most this often */
const EXPIRY_SWEEP_INTERVAL_MS = 60 * 1000;
let lastExpirySweep = 0;

export default class Storage {
  private namespace: string;
  constructor(namespace: string) {
    this.namespace = namespace;
  }
  /**
   * Store a value. When the storage quota is exceeded and `onQuotaExceeded` is given, that callback handles it
   * and nothing is thrown; other errors are thrown.
   */
  public set<V = {}>(key: string | undefined, val: any, expInSeconds: number, onQuotaExceeded?: (e: any) => void) {
    if (!store.enabled) return; //this is probably in private mode. Don't run, as we might get Js errors
    this.removeExpiredKeys();
    if (key && val !== undefined) {
      //try to store string for dom objects (e.g. XML result). Otherwise, we might get a circular reference error when stringifying this
      if (val.documentElement) val = new XMLSerializer().serializeToString(val.documentElement);
      try {
        store.set(key, <ItemWrapper<V>>{
          namespace: this.namespace,
          val: val,
          exp: expInSeconds,
          time: new Date().getTime() / 1000,
        });
      } catch (e) {
        const quotaExceeded = isQuotaExceeded(e);
        if (quotaExceeded && onQuotaExceeded) {
          onQuotaExceeded(e);
          return;
        }
        if (e instanceof Error) (e as QuotaExceededError).quotaExceeded = quotaExceeded;
        throw e;
      }
    }
  }
  remove(key: string) {
    if (!store.enabled) return; //this is probably in private mode. Don't run, as we might get Js errors
    if (key) store.remove(key);
  }
  /**
   * Remove the keys whose expiry time has passed. Runs at most once a minute unless `force` is set, since it
   * reads and parses everything in localStorage.
   */
  removeExpiredKeys(force = false) {
    if (!store.enabled) return;
    const now = Date.now();
    if (!force && now - lastExpirySweep < EXPIRY_SWEEP_INTERVAL_MS) return;
    lastExpirySweep = now;
    store.each((value: ItemWrapper, key: string) => {
      if (value && value.exp && now / 1000 - value.time > value.exp) {
        this.remove(key);
      }
    });
  }
  /** Remove every key stored in this namespace */
  removeAll() {
    this.removeNamespace();
  }
  removeNamespace() {
    if (!store.enabled) return;
    const keys: string[] = [];
    store.each((value: ItemWrapper<any>, key: string) => {
      if (value && value.namespace && value.namespace === this.namespace) keys.push(key);
    });
    keys.forEach((key) => this.remove(key));
  }
  get<V>(key?: string): V | undefined {
    if (!store.enabled) return; //this is probably in private mode. Don't run, as we might get Js errors
    if (!key) return;
    this.removeExpiredKeys();
    const info: ItemWrapper<V> | undefined = store.get(key);
    if (!info) return;
    if (info.exp && Date.now() / 1000 - info.time > info.exp) {
      this.remove(key);
      return;
    }
    return info.val;
  }
}

export function isQuotaExceeded(e: any): boolean {
  if (!e) return false;
  // Current browsers
  if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
  // Older WebKit/Blink (22) and Firefox (1014)
  return e.code === 22 || e.code === 1014;
}
