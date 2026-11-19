/* =========================================================
   CORE OOP: LazyDataLoader — On-Demand Skill Data Loader + Cache
   Prevents Listening / Writing / Speaking payloads from bloating Reading load.
   ========================================================= */
(function () {
  class LazyDataLoader {
    constructor(versionTag = '') {
      this.versionTag = versionTag;
      this._cache = new Map();
      this._inflight = new Map();
      this._skillLoaders = new Map();
    }

    withVersion(url) {
      if (!this.versionTag || !url || url.includes('?v=')) return url;
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}v=${encodeURIComponent(this.versionTag)}`;
    }

    registerSkillLoader(skillId, loaderFn) {
      if (skillId && typeof loaderFn === 'function') {
        this._skillLoaders.set(skillId, loaderFn);
      }
    }

    hasCached(key) {
      return this._cache.has(key);
    }

    getCached(key) {
      return this._cache.get(key) || null;
    }

    setCached(key, data) {
      this._cache.set(key, data);
      return data;
    }

    async loadJson(url, cacheKey = url) {
      if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);
      if (this._inflight.has(cacheKey)) return this._inflight.get(cacheKey);
      const p = fetch(this.withVersion(url), { cache: 'default' })
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
          return res.json();
        })
        .then((data) => {
          this._cache.set(cacheKey, data);
          this._inflight.delete(cacheKey);
          return data;
        })
        .catch((err) => {
          this._inflight.delete(cacheKey);
          throw err;
        });
      this._inflight.set(cacheKey, p);
      return p;
    }

    async loadScript(url, cacheKey = url) {
      if (this._cache.has(cacheKey)) return true;
      if (this._inflight.has(cacheKey)) return this._inflight.get(cacheKey);
      const p = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = this.withVersion(url);
        s.async = true;
        s.onload = () => {
          this._cache.set(cacheKey, true);
          this._inflight.delete(cacheKey);
          resolve(true);
        };
        s.onerror = () => {
          this._inflight.delete(cacheKey);
          reject(new Error(`Failed to load script ${url}`));
        };
        document.body.appendChild(s);
      });
      this._inflight.set(cacheKey, p);
      return p;
    }

    async ensureSkillLoaded(skillId) {
      const cacheKey = `skill:${skillId}`;
      if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);
      const fn = this._skillLoaders.get(skillId);
      if (!fn) return null;
      if (this._inflight.has(cacheKey)) return this._inflight.get(cacheKey);
      const p = Promise.resolve()
        .then(() => fn(this))
        .then((data) => {
          this._cache.set(cacheKey, data || true);
          this._inflight.delete(cacheKey);
          return data;
        })
        .catch((err) => {
          this._inflight.delete(cacheKey);
          throw err;
        });
      this._inflight.set(cacheKey, p);
      return p;
    }
  }

  window.CoreLazyDataLoader = LazyDataLoader;
})();
