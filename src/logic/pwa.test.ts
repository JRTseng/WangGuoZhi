import { describe, expect, it } from 'vitest';
import {
  cacheNameFor,
  installModeFor,
  isIos,
  precacheList,
  serviceWorkerSource,
  shouldRegisterServiceWorker,
} from './pwa';

describe('shouldRegisterServiceWorker', () => {
  const ok = { prod: true, supported: true, secure: true, webdriver: false, search: '' };

  it('正式版、瀏覽器支援、https 才啟用', () => {
    expect(shouldRegisterServiceWorker(ok)).toBe(true);
    expect(shouldRegisterServiceWorker({ ...ok, prod: false })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...ok, supported: false })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...ok, secure: false })).toBe(false);
  });

  it('自動化測試預設不啟用，?sw=1 可以打開', () => {
    expect(shouldRegisterServiceWorker({ ...ok, webdriver: true })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...ok, webdriver: true, search: '?fast=1&sw=1' })).toBe(
      true,
    );
  });

  it('?sw=0 可以關掉；開發模式加 ?sw=1 也不啟用', () => {
    expect(shouldRegisterServiceWorker({ ...ok, search: '?sw=0' })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...ok, prod: false, search: '?sw=1' })).toBe(false);
  });
});

describe('isIos', () => {
  it('iPhone 與 iPad', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1')).toBe(true);
    expect(isIos('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
  });

  it('假裝成 Mac 的 iPad 看觸控點', () => {
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15';
    expect(isIos(mac, 'MacIntel', 5)).toBe(true);
    expect(isIos(mac, 'MacIntel', 0)).toBe(false);
  });

  it('Android 不是', () => {
    expect(isIos('Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140.0 Mobile', 'Linux', 5)).toBe(
      false,
    );
  });
});

describe('installModeFor', () => {
  it('已經從主畫面開的優先', () => {
    expect(installModeFor({ standalone: true, canPrompt: true, ios: true })).toBe('installed');
  });

  it('能跳安裝視窗就用視窗，iPhone 用說明，其他不顯示', () => {
    expect(installModeFor({ standalone: false, canPrompt: true, ios: false })).toBe('prompt');
    expect(installModeFor({ standalone: false, canPrompt: false, ios: true })).toBe('ios');
    expect(installModeFor({ standalone: false, canPrompt: false, ios: false })).toBe('none');
  });
});

describe('cacheNameFor', () => {
  it('帶版本號，奇怪的字拿掉', () => {
    expect(cacheNameFor('v0.1.0+a1b2c3d')).toBe('wgz-v0.1.0+a1b2c3d');
    expect(cacheNameFor(' v1 "x" ')).toBe('wgz-v1x');
    expect(cacheNameFor('')).toBe('wgz-dev');
  });
});

describe('precacheList', () => {
  it('首頁用 ./，不存 sw.js 與 source map，不重複', () => {
    expect(
      precacheList([
        'index.html',
        'sw.js',
        'assets/index-abc.js',
        'assets/index-abc.js.map',
        './manifest.webmanifest',
        'icons\\icon-192.png',
        'assets/index-abc.js',
        '.nojekyll',
      ]),
    ).toEqual(['./', 'assets/index-abc.js', 'icons/icon-192.png', 'manifest.webmanifest']);
  });
});

// 用假的瀏覽器環境把產生出來的 service worker 真的跑一遍
type Handler = (event: Record<string, unknown>) => void;

class FakeResponse {
  constructor(
    readonly body: string,
    readonly ok = true,
    readonly type = 'basic',
  ) {}
  clone(): FakeResponse {
    return new FakeResponse(this.body, this.ok, this.type);
  }
}

class FakeRequest {
  readonly method = 'GET';
  constructor(
    readonly url: string,
    readonly init: { cache?: string; mode?: string } = {},
  ) {}
  get mode(): string {
    return this.init.mode ?? 'no-cors';
  }
}

const ORIGIN = 'https://example.test';
const BASE = `${ORIGIN}/game/`;
const abs = (u: string) => new URL(u, BASE).href;

function makeWorld(
  version: string,
  files: string[],
  stores = new Map<string, Map<string, FakeResponse>>(),
) {
  const handlers = new Map<string, Handler>();
  const net = {
    online: true,
    hang: false,
    fetched: [] as { url: string; cache?: string }[],
    site: new Map<string, string>(),
  };
  const state = { skipped: false, claimed: false };

  const cacheApi = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    const key = (r: string | FakeRequest) => abs(typeof r === 'string' ? r : r.url);
    return {
      async addAll(reqs: FakeRequest[]) {
        for (const r of reqs) store.set(key(r), await fetchImpl(r));
      },
      async match(r: string | FakeRequest) {
        return store.get(key(r));
      },
      async put(r: string | FakeRequest, res: FakeResponse) {
        store.set(key(r), res);
      },
    };
  };
  const caches = {
    open: async (name: string) => cacheApi(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };

  async function fetchImpl(input: string | FakeRequest, init?: { cache?: string }) {
    const url = abs(typeof input === 'string' ? input : input.url);
    const cache = typeof input === 'string' ? init?.cache : input.init.cache;
    net.fetched.push({ url, cache });
    if (net.hang) return new Promise<FakeResponse>(() => undefined);
    if (!net.online) throw new TypeError('offline');
    const body = net.site.get(url);
    return body === undefined ? new FakeResponse('404', false) : new FakeResponse(body);
  }

  const self = {
    location: { href: `${BASE}sw.js` },
    addEventListener: (type: string, h: Handler) => handlers.set(type, h),
    skipWaiting: async () => {
      state.skipped = true;
    },
    clients: {
      claim: async () => {
        state.claimed = true;
      },
    },
  };

  const fastTimeout = (fn: () => void) => setTimeout(fn, 5);
  new Function(
    'self',
    'caches',
    'fetch',
    'Request',
    'setTimeout',
    serviceWorkerSource({ version, files }),
  )(self, caches, fetchImpl, FakeRequest, fastTimeout);

  async function lifecycle(type: 'install' | 'activate') {
    let done: Promise<unknown> = Promise.resolve();
    handlers.get(type)!({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  }
  /** 回傳 null 代表 service worker 沒有接手這個請求 */
  async function request(url: string, mode = 'no-cors', method = 'GET') {
    let answer: Promise<FakeResponse> | null = null;
    const req = Object.assign(new FakeRequest(abs(url), { mode }), { method });
    handlers.get('fetch')!({
      request: req,
      respondWith: (p: Promise<FakeResponse>) => (answer = p),
    });
    return answer as Promise<FakeResponse> | null;
  }

  return { stores, net, state, lifecycle, request };
}

describe('serviceWorkerSource', () => {
  const files = ['index.html', 'assets/index-abc.js', 'manifest.webmanifest', 'sw.js'];
  const site = (w: ReturnType<typeof makeWorld>, tag: string) => {
    w.net.site.set(abs('./'), `page-${tag}`);
    w.net.site.set(abs('assets/index-abc.js'), `js-${tag}`);
    w.net.site.set(abs('manifest.webmanifest'), `manifest-${tag}`);
  };

  it('安裝時把清單裡的檔案都存起來，而且不拿瀏覽器的舊快取', async () => {
    const w = makeWorld('v1', files);
    site(w, 'a');
    await w.lifecycle('install');
    const store = w.stores.get('wgz-v1')!;
    expect([...store.keys()].sort()).toEqual(
      [abs('./'), abs('assets/index-abc.js'), abs('manifest.webmanifest')].sort(),
    );
    expect(w.net.fetched.every((f) => f.cache === 'reload')).toBe(true);
    expect(w.state.skipped).toBe(true);
  });

  it('啟用時清掉舊版快取，別人的快取不動', async () => {
    const w = makeWorld('v2', files);
    site(w, 'a');
    w.stores.set('wgz-v1', new Map());
    w.stores.set('other-app', new Map());
    await w.lifecycle('install');
    await w.lifecycle('activate');
    expect([...w.stores.keys()].sort()).toEqual(['other-app', 'wgz-v2']);
    expect(w.state.claimed).toBe(true);
  });

  it('有網路時開網頁拿最新的首頁（帶參數也一樣）', async () => {
    const w = makeWorld('v1', files);
    site(w, 'a');
    await w.lifecycle('install');
    w.net.site.set(abs('./?v=48'), 'page-new');
    const res = await w.request('./?v=48', 'navigate');
    expect(res!.body).toBe('page-new');
    expect(w.net.fetched.at(-1)).toEqual({ url: abs('./?v=48'), cache: 'no-cache' });
  });

  it('沒網路時開網頁用存起來的首頁', async () => {
    const w = makeWorld('v1', files);
    site(w, 'a');
    await w.lifecycle('install');
    w.net.online = false;
    expect((await w.request('./?fast=1', 'navigate'))!.body).toBe('page-a');
    expect((await w.request('index.html', 'navigate'))!.body).toBe('page-a');
  });

  it('網路太慢也先用存起來的首頁', async () => {
    const w = makeWorld('v1', files);
    site(w, 'a');
    await w.lifecycle('install');
    w.net.hang = true;
    expect((await w.request('./', 'navigate'))!.body).toBe('page-a');
  });

  it('沒網路又沒存過就照實失敗', async () => {
    const w = makeWorld('v1', files);
    w.net.online = false;
    await expect(w.request('./', 'navigate')).rejects.toThrow('offline');
  });

  it('程式檔先用存起來的，沒網路也拿得到', async () => {
    const w = makeWorld('v1', files);
    site(w, 'a');
    await w.lifecycle('install');
    const before = w.net.fetched.length;
    w.net.online = false;
    expect((await w.request('assets/index-abc.js'))!.body).toBe('js-a');
    expect(w.net.fetched.length).toBe(before);
  });

  it('沒存過的檔案上網抓，抓到就存起來', async () => {
    const w = makeWorld('v1', files);
    site(w, 'a');
    await w.lifecycle('install');
    w.net.site.set(abs('assets/index-new.js'), 'js-new');
    expect((await w.request('assets/index-new.js'))!.body).toBe('js-new');
    w.net.online = false;
    expect((await w.request('assets/index-new.js'))!.body).toBe('js-new');
    // 抓不到的不存
    w.net.online = true;
    expect((await w.request('assets/missing.js'))!.ok).toBe(false);
    expect(w.stores.get('wgz-v1')!.has(abs('assets/missing.js'))).toBe(false);
  });

  it('別的網站、別的資料夾、不是 GET 的請求不接手', async () => {
    const w = makeWorld('v1', files);
    expect(await w.request('https://other.test/x.js')).toBeNull();
    expect(await w.request(`${ORIGIN}/another/app.js`)).toBeNull();
    expect(await w.request('./', 'navigate', 'POST')).toBeNull();
  });
});
