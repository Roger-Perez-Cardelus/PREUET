/* ===== store.js ===== */
/* ---------- persistence: Claude db (artifact) · Supabase (public web) · local fallback ---------- */
const LS_USER = "preuet:user:v1", LS_COMM = "preuet:community:v1", LS_TESTS = "preuet:tests:v1", LS_TEAMKEY = "preuet:teamkey";
function lsGet(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: keep in memory */ } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

function defaultUser() {
  return { v: 1, updated: 0, lang: "ca", onboarded: false, seg: null, diets: [], avoid: [], town: "Castelldefels",
    chains: null, brand: "any", fresh: true, estimate: true, w: 0.6, basket: [], schedules: [], nick: "", selChain: null, recipeChain: null };
}
function cleanUser(u) {
  const d = defaultUser();
  if (!u || typeof u !== "object") return d;
  const o = Object.assign(d, u);
  o.basket = Array.isArray(o.basket) ? o.basket.filter(x => x && X.P.has(x.p)).map(x => ({ p: x.p, n: clamp(Math.round(Number(x.n) || 1), 1, 99) })) : [];
  o.schedules = Array.isArray(o.schedules) ? o.schedules.filter(s => s && s.id && Array.isArray(s.items)) : [];
  o.diets = Array.isArray(o.diets) ? o.diets.filter(x => DIET_TAGS.includes(x)) : [];
  o.avoid = Array.isArray(o.avoid) ? o.avoid.filter(x => ALLERGENS.includes(x)) : [];
  if (o.chains && !Array.isArray(o.chains)) o.chains = null;
  if (Array.isArray(o.chains)) o.chains = o.chains.filter(c => X.C.has(c));
  o.lang = o.lang === "es" ? "es" : "ca";
  o.w = clamp(Number(o.w) || 0.6, 0, 1);
  o.town = String(o.town || "Castelldefels").slice(0, 60);
  o.nick = String(o.nick || "").slice(0, 30);
  return o;
}

const C_TYPES = new Set(["stock", "price", "comment", "rating", "origin", "suggest"]);
function str(v, n) { return typeof v === "string" ? v.slice(0, n) : ""; }
function cleanItem(it) { // shared data is other people's input: keep only known fields, bounded
  if (!it || typeof it !== "object" || !C_TYPES.has(it.t)) return null;
  const o = { t: it.t, id: str(it.id, 40) || uid(), ts: Number(it.ts) || 0, uid: str(it.uid, 120), nick: str(it.nick, 30) };
  if (it.p && X.P.has(it.p)) o.p = it.p;
  if (it.c && X.C.has(it.c)) o.c = it.c;
  o.town = str(it.town, 60);
  if (it.t === "stock") { if (!["si", "poc", "no"].includes(it.s) || !o.p || !o.c) return null; o.s = it.s; }
  if (it.t === "price") { o.price = Number(it.price); o.size = Number(it.size); if (!o.p || !o.c || !(o.price > 0 && o.price < 500) || !(o.size > 0 && o.size < 100)) return null; }
  if (it.t === "comment" || it.t === "suggest") { o.txt = str(it.txt, 280); o.target = str(it.target, 60); if (!o.txt.trim()) return null; }
  if (it.t === "rating") { o.stars = clamp(Math.round(Number(it.stars) || 0), 1, 5); o.target = str(it.target, 60); if (!o.target) return null; }
  if (it.t === "origin") { o.txt = str(it.txt, 80); if (!o.p || !o.txt.trim()) return null; }
  return o;
}
function pruneMine(items) {
  const now = Date.now();
  let a = items.filter(x => x && !(x.t === "stock" && now - x.ts > 14 * DAY));
  const seen = new Set();
  a = a.slice().reverse().filter(x => { // one rating per target: keep the newest
    if (x.t !== "rating") return true;
    if (seen.has(x.target)) return false;
    seen.add(x.target); return true;
  }).reverse();
  if (a.length > 400) a = a.slice(a.length - 400);
  while (a.length && JSON.stringify(a).length > 200000) a = a.slice(1);
  return a.map(({ uid: _u, ...rest }) => rest);
}

const Store = {
  mode: "local", me: { id: null, name: "", avatar: "", isOwner: false, canWrite: null }, db: null, userCap: null, supa: null,
  sandbox: false, sandboxItems: [], v2: false, _myIds: new Set(), _mine: null, _q: Promise.resolve(), _commCb: null, _localComm: [],
  queue(fn) { const p = this._q.then(fn, fn); this._q = p.catch(() => {}); return p; },

  async initClaude() {
    if (!window.claude || typeof window.claude.use !== "function") return false;
    let db = null, user = null;
    try { [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]); } catch (e) { return false; }
    if (!db) return false;
    this.db = db; this.userCap = user;
    let me = { id: null, name: "", avatarUrl: "", isOwner: false };
    try { if (user) me = await user.me(); } catch (e) { /* defaults */ }
    let canWrite = null;
    try { canWrite = user ? await user.can("data.write") : null; } catch (e) { canWrite = null; }
    this.me = { id: me.id || null, name: me.name || "", avatar: me.avatarUrl || "", isOwner: !!me.isOwner, canWrite };
    this.mode = "claude";
    return true;
  },
  async initSupabase(cfg) {
    if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return false;
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    let { data } = await sb.auth.getSession();
    let session = data && data.session;
    if (!session) {
      const captchaToken = cfg.turnstileSiteKey ? await turnstileToken(cfg.turnstileSiteKey) : undefined;
      const r = await sb.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined);
      if (r.error) throw r.error;
      session = r.data.session;
    }
    this.supa = sb;
    this.me = { id: session.user.id, name: "", avatar: "", isOwner: false, canWrite: true };
    try { const r = await sb.rpc("is_admin"); this.me.isOwner = !!(r && r.data); } catch (e) { /* not admin */ }
    // schema v2 (supabase/schema.sql of November 2026) serves the feed through functions that hide who wrote what
    try { const r = await sb.rpc("preuet_schema"); this.v2 = !r.error && Number(r.data) >= 2; } catch (e) { this.v2 = false; }
    this.mode = "supabase";
    return true;
  },
  canContribute() {
    if (this.sandbox) return true;
    if (this.mode === "claude") return !!this.me.id && this.me.canWrite !== false;
    return true;
  },

  /* ----- community ----- */
  subscribeCommunity(cb) {
    this._commCb = cb;
    const emitAll = list => cb(list.concat(this.sandboxItems));
    if (this.mode === "claude") {
      let last = [];
      this._emitClaude = () => emitAll(last);
      return this.db.collection("community").onSnapshot(snap => {
        const all = [];
        let mine = null;
        for (const d of snap.docs) {
          const body = d.data() || {};
          if (d.id === this.me.id) mine = body;
          for (const raw of Array.isArray(body.items) ? body.items : []) {
            const it = cleanItem(Object.assign({}, raw, { uid: d.id }));
            if (it) all.push(it);
          }
        }
        this._mine = { items: mine && Array.isArray(mine.items) ? mine.items.slice() : [] };
        last = all;
        emitAll(all);
      }, err => { console.warn("community feed", err && err.code); emitAll(last); });
    }
    if (this.mode === "supabase") return this._subscribeSupabase(emitAll);
    this._localComm = (lsGet(LS_COMM) || []).map(cleanItem).filter(Boolean);
    emitAll(this._localComm);
    return () => {};
  },
  /* Supabase feed: one full read (last 120 days, newest 3000), then each new or deleted item arrives on its own through
     Realtime and is applied to the list; a full re-read every 5 minutes catches anything missed. */
  _rowItem(row) {
    const uid = row.user_id || (row.mine || this._myIds.has(row.id) ? this.me.id : "x:" + row.id);
    return cleanItem(Object.assign({}, row.payload || {}, { t: row.type, id: row.id, uid, ts: Date.parse(row.created_at) }));
  },
  _subscribeSupabase(emitAll) {
    const sb = this.supa;
    let byId = new Map(), timer = null;
    const emit = () => { clearTimeout(timer); timer = setTimeout(() => emitAll([...byId.values()].sort((a, b) => a.ts - b.ts)), 120); };
    const put = row => { const it = this._rowItem(row); if (it) { if (it.t === "rating") for (const [k, x] of byId) if (x.t === "rating" && x.uid === it.uid && x.target === it.target && k !== it.id) byId.delete(k); byId.set(it.id, it); } };
    const load = async () => {
      const since = new Date(Date.now() - 120 * DAY).toISOString();
      const r = this.v2
        ? await sb.rpc("list_contributions", { p_since: since, p_limit: 3000 })
        : await sb.from("contributions").select("id,user_id,type,payload,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(3000);
      if (r.error) { console.warn(r.error); return; }
      byId = new Map();
      r.data.slice().reverse().forEach(put);
      emit();
    };
    this._supaPut = row => { put(row); emit(); };
    this._supaDel = id => { if (byId.delete(id)) emit(); };
    this._emitSupa = () => emitAll([...byId.values()].sort((a, b) => a.ts - b.ts));
    load();
    const ch = this.v2
      ? sb.channel("preuet:contributions").on("broadcast", { event: "insert" }, m => this._supaPut(m.payload)).on("broadcast", { event: "delete" }, m => this._supaDel(m.payload && m.payload.id)).subscribe()
      : sb.channel("contrib").on("postgres_changes", { event: "*", schema: "public", table: "contributions" }, ev => {
          if (ev.eventType === "INSERT" && ev.new) this._supaPut(ev.new);
          else if (ev.eventType === "DELETE" && ev.old) this._supaDel(ev.old.id);
          else load();
        }).subscribe();
    const iv = setInterval(load, 5 * 60000);
    return () => { try { sb.removeChannel(ch); } catch (e) { /* ignore */ } clearInterval(iv); };
  },
  refreshCommunity() {
    if (!this._commCb) return;
    if (this.mode === "claude" && this._emitClaude) return this._emitClaude();
    if (this.mode === "supabase" && this._emitSupa) return this._emitSupa();
    this._commCb(this._localComm.concat(this.sandboxItems));
  },
  async addContribution(raw) {
    const item = cleanItem(Object.assign({ id: uid(), ts: Date.now(), uid: this.me.id || "local" }, raw));
    if (!item) throw { code: "invalid_argument" };
    if (this.sandbox) {
      if (item.t === "rating") this.sandboxItems = this.sandboxItems.filter(x => !(x.t === "rating" && x.target === item.target));
      this.sandboxItems.push(Object.assign({}, item, { uid: this.me.id || "test" }));
      this.refreshCommunity();
      return item;
    }
    if (this.mode === "claude") {
      if (!this.me.id) throw { code: "no_id" };
      await this.queue(async () => {
        if (!this._mine) {
          const s = await this.db.doc("community/" + this.me.id).get();
          this._mine = { items: s.exists && Array.isArray((s.data() || {}).items) ? s.data().items.slice() : [] };
        }
        let cur = this._mine.items.slice();
        if (item.t === "rating") cur = cur.filter(x => !(x.t === "rating" && x.target === item.target));
        const items = pruneMine(cur.concat([item]));
        try {
          await this.db.doc("community/" + this.me.id).set({ v: 1, items, updated: Date.now() });
        } catch (e) {
          if (e && e.code === "invalid_argument") this.me.canWrite = false;
          throw e;
        }
        this._mine = { items };
      });
      return item;
    }
    if (this.mode === "supabase") {
      const sb = this.supa;
      const { t: type, id: _i, uid: _u, ts: _t, ...payload } = item;
      if (this.v2) { // the server replaces an earlier rating of the same thing and hides the author from everyone else
        const r = await sb.rpc("add_contribution", { p_type: type, p_payload: payload });
        if (r.error) throw r.error;
        const row = Array.isArray(r.data) ? r.data[0] : r.data;
        if (row && row.id) { this._myIds.add(row.id); if (this._supaPut) this._supaPut({ id: row.id, type, payload, created_at: row.created_at, mine: true }); }
        return item;
      }
      if (item.t === "rating") await sb.from("contributions").delete().eq("user_id", this.me.id).eq("type", "rating").eq("payload->>target", item.target);
      const r = await sb.from("contributions").insert({ type, payload });
      if (r.error) throw r.error;
      return item;
    }
    if (item.t === "rating") this._localComm = this._localComm.filter(x => !(x.t === "rating" && x.target === item.target));
    this._localComm.push(item);
    this._localComm = this._localComm.slice(-500);
    lsSet(LS_COMM, this._localComm);
    this.refreshCommunity();
    return item;
  },
  async removeContribution(ownerUid, id) {
    if (this.sandbox && this.sandboxItems.some(x => x.id === id)) {
      this.sandboxItems = this.sandboxItems.filter(x => x.id !== id); this.refreshCommunity(); return;
    }
    if (this.mode === "claude") {
      await this.queue(async () => {
        if (ownerUid === this.me.id) {
          const items = ((this._mine && this._mine.items) || []).filter(x => x.id !== id);
          await this.db.doc("community/" + this.me.id).set({ v: 1, items, updated: Date.now() });
          this._mine = { items };
        } else if (this.me.isOwner) {
          const ref = this.db.doc("community/" + ownerUid);
          const s = await ref.get();
          if (!s.exists) return;
          const body = s.data() || {};
          const items = (Array.isArray(body.items) ? body.items : []).filter(x => x && x.id !== id);
          await ref.set({ v: 1, items, updated: Date.now(), moderated: Date.now() });
        }
      });
      return;
    }
    if (this.mode === "supabase") {
      const r = this.v2 ? await this.supa.rpc("delete_contribution", { p_id: id }) : await this.supa.from("contributions").delete().eq("id", id);
      if (r.error) throw r.error;
      if (this._supaDel) this._supaDel(id);
      return;
    }
    this._localComm = this._localComm.filter(x => x.id !== id);
    lsSet(LS_COMM, this._localComm);
    this.refreshCommunity();
  },
  async profiles(ids) {
    if (this.mode === "claude" && this.userCap && ids.length) {
      try { return await this.userCap.profiles(ids); } catch (e) { return {}; }
    }
    return {};
  },

  /* ----- per-viewer state ----- */
  async loadUser() {
    const local = lsGet(LS_USER);
    let remote = null;
    try {
      if (this.mode === "claude" && this.me.id) {
        const s = await this.db.doc("data/users/" + this.me.id + "/profile").get();
        remote = s.exists ? s.data() : null;
      } else if (this.mode === "supabase") {
        const r = await this.supa.from("user_state").select("state").eq("user_id", this.me.id).maybeSingle();
        remote = r.data ? r.data.state : null;
      }
    } catch (e) { console.warn("load user", e && e.code); }
    if (remote && (!local || (remote.updated || 0) >= (local.updated || 0))) return remote;
    return local;
  },
  async saveUser(u) {
    if (this.sandbox) return;
    const body = JSON.parse(JSON.stringify(u));
    lsSet(LS_USER, body);
    if (this.mode === "claude" && this.me.id) {
      await this.queue(() => this.db.doc("data/users/" + this.me.id + "/profile").set(body)).catch(e => console.warn("save user", e && e.code));
    } else if (this.mode === "supabase") {
      const r = await this.supa.from("user_state").upsert({ user_id: this.me.id, state: body, updated_at: new Date().toISOString() });
      if (r.error) { console.warn("save user", r.error); if (!this._saveWarned) { this._saveWarned = true; toast(t("sync_failed")); } }
      else this._saveWarned = false;
    }
  },
  async clearUser() {
    lsDel(LS_USER);
    if (this.mode === "claude" && this.me.id) await this.queue(() => this.db.doc("data/users/" + this.me.id + "/profile").delete()).catch(() => {});
    if (this.mode === "supabase") await this.supa.from("user_state").delete().eq("user_id", this.me.id);
  },

  /* ----- solution tests S01–S10 ----- */
  subscribeTests(cb) {
    const local = () => lsGet(LS_TESTS) || {};
    if (this.mode === "claude") {
      return this.db.collection("tests").onSnapshot(snap => {
        const o = Object.assign({}, local());
        for (const d of snap.docs) if (/^S(0[1-9]|10)$/.test(d.id)) o[d.id] = Object.assign({ _shared: true }, d.data());
        cb(o);
      }, () => cb(local()));
    }
    if (this.mode === "supabase") {
      const load = async () => {
        const key = lsGet(LS_TEAMKEY);
        const o = Object.assign({}, local());
        if (key) {
          const r = await this.supa.rpc("list_tests", { team_key: key });
          if (!r.error && Array.isArray(r.data)) r.data.forEach(row => { o[row.code] = Object.assign({ _shared: true }, row.data); });
        }
        cb(o);
      };
      this._reloadTests = load;
      load();
      return () => {};
    }
    cb(local());
    this._reloadTests = () => cb(local());
    return () => {};
  },
  async saveTest(code, data) {
    const body = JSON.parse(JSON.stringify(data));
    if (this.mode === "claude") {
      try { await this.queue(() => this.db.doc("tests/" + code).set(body)); return "shared"; }
      catch (e) { console.warn("save test", e && e.code); }
    }
    if (this.mode === "supabase") {
      const key = lsGet(LS_TEAMKEY);
      if (key) {
        const r = await this.supa.rpc("save_test", { p_code: code, p_data: body, team_key: key });
        if (!r.error) { if (this._reloadTests) this._reloadTests(); return "shared"; }
      }
    }
    const all = lsGet(LS_TESTS) || {};
    all[code] = body;
    lsSet(LS_TESTS, all);
    if (this._reloadTests) this._reloadTests();
    return "local";
  },
};

/* ---------- Cloudflare Turnstile: proves a person is behind a new anonymous Supabase user (optional, see README) ---------- */
function turnstileToken(sitekey) {
  return new Promise((resolve, reject) => {
    const go = () => {
      const box = document.createElement("div");
      box.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:90";
      document.body.appendChild(box);
      const done = f => v => { box.remove(); f(v); };
      window.turnstile.render(box, { sitekey, appearance: "interaction-only", callback: done(resolve), "error-callback": done(() => reject(new Error("captcha"))), "timeout-callback": done(() => reject(new Error("captcha timeout"))) });
    };
    if (window.turnstile) return go();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true; s.onload = go; s.onerror = () => reject(new Error("captcha script"));
    document.head.appendChild(s);
  });
}

/* ---------- downloads & clipboard ---------- */
let DL = null;
async function initDownloads() {
  try { if (window.claude && window.claude.use) DL = await window.claude.use("downloads"); } catch (e) { DL = null; }
}
function canDownload() { return !!DL || !window.claude; }
async function saveFile(filename, text, mime) {
  if (DL) {
    try { await DL.save({ filename, data: text }); return "saved"; }
    catch (e) { if (e && e.code === "declined") return "declined"; console.warn("download", e && e.code); return "error"; }
  }
  if (window.claude) return "error";
  try {
    const blob = new Blob([text], { type: (mime || "text/plain") + ";charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return "saved";
  } catch (e) { return "error"; }
}
