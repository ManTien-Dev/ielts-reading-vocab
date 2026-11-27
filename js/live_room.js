/* =========================================================
   LIVE READING ROOM — Real-time Google-Docs-Style Collaboration
   Supports:
   1. Firebase Realtime Database (native HTTPS SSE EventSource < 200ms push, zero SDK bloat)
   2. Local BroadcastChannel + localStorage mirror (instant multi-tab sync & offline-safe fallback)
   Syncs: Pastel Highlights (text-offset), Notes, Locate / Focus Pointer, Shared Answers & Presence.
   ========================================================= */
(function () {
  const RTDB_LS_KEY = 'ielts_live_rtdb_url_v1';
  const SNAP_PREFIX = 'totoro_rp_live_snap_';
  const PENDING_URL_KEY = 'totoro_rp_live_pending_url';
  const HEARTBEAT_MS = 15000;
  const STALE_PRESENCE_MS = 48000;

  const AVATAR_PALETTE = [
    '#4A7C59', '#3B82F6', '#D97706', '#DB2777', '#7C3AED', '#0D9488', '#EA580C', '#2563EB'
  ];

  const clientId = 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

  let active = null;
  /* active = {
       roomId, passageId, isFull, dbUrl, isHost,
       user: { uid, name, role, color },
       state: { meta, highlights, notes, answers, focus, presence },
       bc, es, pollTimer, hbTimer,
       onUpdate, onStatus, status: 'local' | 'connecting' | 'connected' | 'error'
     } */

  function normalizeDbUrl(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    s = s.replace(/\/+$/, '').replace(/\.json$/i, '');
    try {
      const u = new URL(s);
      if (!/(firebaseio\.com|firebasedatabase\.app)$/i.test(u.hostname)) return '';
      return `${u.protocol}//${u.host}`;
    } catch (_) {
      return '';
    }
  }

  function getConfiguredDbUrl() {
    const fromGlobal = normalizeDbUrl(window.APP_LIVE_DB_URL || '');
    if (fromGlobal) return fromGlobal;
    try {
      const fromLs = normalizeDbUrl(localStorage.getItem(RTDB_LS_KEY) || '');
      if (fromLs) return fromLs;
    } catch (_) {}
    return '';
  }

  function saveDbUrl(raw) {
    const clean = normalizeDbUrl(raw);
    try {
      if (clean) localStorage.setItem(RTDB_LS_KEY, clean);
      else localStorage.removeItem(RTDB_LS_KEY);
    } catch (_) {}
    return clean;
  }

  function pickUserColor(uid, role) {
    if (role === 'teacher') return '#2E6F40';
    let h = 0;
    const s = String(uid || 'u');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
  }

  function generateRoomId() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let out = 'rp';
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function createEmptyRoomState(meta = {}) {
    return {
      meta: {
        passageId: meta.passageId || '',
        isFull: !!meta.isFull,
        hostId: meta.hostId || '',
        hostName: meta.hostName || 'Giáo viên',
        permission: meta.permission === 'watch' ? 'watch' : 'collab',
        syncAnswers: meta.syncAnswers !== false,
        revealAnswers: !!meta.revealAnswers,
        createdAt: meta.createdAt || Date.now()
      },
      highlights: {},
      notes: [],
      answers: {},
      focus: null,
      presence: {}
    };
  }

  function ensureNormalizedState(raw) {
    const base = createEmptyRoomState(raw?.meta || {});
    if (raw && typeof raw === 'object') {
      if (raw.meta && typeof raw.meta === 'object') {
        base.meta = { ...base.meta, ...raw.meta };
      }
      if (raw.highlights && typeof raw.highlights === 'object') {
        base.highlights = {};
        Object.keys(raw.highlights).forEach((pid) => {
          const v = raw.highlights[pid];
          base.highlights[pid] = Array.isArray(v) ? v.filter(Boolean) : (v && typeof v === 'object' ? Object.values(v).filter(Boolean) : []);
        });
      }
      if (Array.isArray(raw.notes)) {
        base.notes = raw.notes.filter(Boolean);
      } else if (raw.notes && typeof raw.notes === 'object') {
        base.notes = Object.values(raw.notes).filter(Boolean);
      }
      if (raw.answers && typeof raw.answers === 'object') {
        base.answers = { ...raw.answers };
      }
      if (raw.focus && typeof raw.focus === 'object') {
        base.focus = { ...raw.focus };
      }
      if (raw.presence && typeof raw.presence === 'object') {
        base.presence = { ...raw.presence };
      }
    }
    return base;
  }

  function applyPathMutation(rootObj, relPath, data, isPatch) {
    const clean = String(relPath || '/').replace(/^\/+|\/+$/g, '');
    if (!clean) {
      if (isPatch && data && typeof data === 'object') {
        Object.keys(data).forEach((k) => {
          applyPathMutation(rootObj, k, data[k], false);
        });
        return;
      }
      const myOwnPres = rootObj?.presence?.[clientId] || null;
      const next = ensureNormalizedState(data || {});
      if (myOwnPres && !next.presence[clientId]) {
        next.presence[clientId] = myOwnPres;
      }
      Object.assign(rootObj, next);
      return;
    }
    const parts = clean.split('/');
    let cur = rootObj;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (!cur[seg] || typeof cur[seg] !== 'object') cur[seg] = {};
      cur = cur[seg];
    }
    const last = parts[parts.length - 1];
    if (data === null || data === undefined) {
      delete cur[last];
    } else if (isPatch && cur[last] && typeof cur[last] === 'object' && typeof data === 'object' && !Array.isArray(data)) {
      Object.assign(cur[last], data);
    } else {
      cur[last] = data;
    }
    // Keep highlights & notes normalized as arrays
    if (parts[0] === 'highlights' && parts[1]) {
      const v = rootObj.highlights[parts[1]];
      rootObj.highlights[parts[1]] = Array.isArray(v) ? v.filter(Boolean) : (v && typeof v === 'object' ? Object.values(v).filter(Boolean) : []);
    }
    if (parts[0] === 'notes') {
      const v = rootObj.notes;
      rootObj.notes = Array.isArray(v) ? v.filter(Boolean) : (v && typeof v === 'object' ? Object.values(v).filter(Boolean) : []);
    }
  }

  function persistLocalSnap(room) {
    if (!room) return;
    try {
      localStorage.setItem(SNAP_PREFIX + room.roomId, JSON.stringify(room.state));
    } catch (_) {}
  }

  function readLocalSnap(roomId) {
    try {
      const raw = localStorage.getItem(SNAP_PREFIX + roomId);
      return raw ? ensureNormalizedState(JSON.parse(raw)) : null;
    } catch (_) {
      return null;
    }
  }

  function notifyUpdate(changedPath) {
    if (!active) return;
    try {
      active.onUpdate?.(active.state, changedPath || '/');
    } catch (_) {}
  }

  function setStatus(st) {
    if (!active) return;
    active.status = st;
    try {
      active.onStatus?.(st);
    } catch (_) {}
  }

  function writeRemote(relPath, payload, method = 'PUT', useKeepalive = false) {
    if (!active) return Promise.resolve(false);
    const room = active;
    const normPath = String(relPath || '/').replace(/^\/+|\/+$/g, '');

    // 1. Update local state mirror immediately
    applyPathMutation(room.state, normPath, payload, method === 'PATCH');
    persistLocalSnap(room);

    // 2. Broadcast instantaneously to same-origin tabs via BroadcastChannel
    if (room.bc) {
      try {
        room.bc.postMessage({
          sender: clientId,
          path: normPath,
          method,
          data: payload,
          ts: Date.now()
        });
      } catch (_) {}
    }

    // 3. Push to Firebase Realtime Database if configured (< 200ms to all devices)
    if (!room.dbUrl) return Promise.resolve(true);
    const url = `${room.dbUrl}/rp_live/${encodeURIComponent(room.roomId)}${normPath ? '/' + normPath : ''}.json`;
    const body = method === 'DELETE' ? undefined : JSON.stringify(payload);
    return fetch(url, {
      method,
      headers: method === 'DELETE' ? undefined : { 'Content-Type': 'application/json' },
      body,
      keepalive: Boolean(useKeepalive)
    }).then((res) => res.ok).catch(() => false);
  }

  function startFirebaseStream(room) {
    if (!room.dbUrl) {
      setStatus('local');
      return;
    }
    const streamUrl = `${room.dbUrl}/rp_live/${encodeURIComponent(room.roomId)}.json`;
    setStatus('connecting');

    const startFallbackPoll = () => {
      if (!active || active.roomId !== room.roomId) return;
      if (room.pollTimer) return;
      const pollOnce = async () => {
        if (!active || active.roomId !== room.roomId) return;
        try {
          const res = await fetch(streamUrl, { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            if (json) {
              const next = ensureNormalizedState(json);
              Object.assign(room.state, next);
              persistLocalSnap(room);
              setStatus('connected');
              notifyUpdate('/');
            }
          }
        } catch (_) {}
      };
      pollOnce();
      room.pollTimer = setInterval(pollOnce, 1800);
    };

    if (typeof EventSource === 'function') {
      try {
        const es = new EventSource(streamUrl);
        room.es = es;

        const handleSse = (isPatch) => (ev) => {
          if (!active || active.roomId !== room.roomId) return;
          try {
            const msg = JSON.parse(ev.data || '{}');
            if (!msg || typeof msg !== 'object') return;
            const p = String(msg.path || '/');
            if (p === '/' && msg.data === null) {
              // Room didn't exist yet on Firebase -> host initializes it cleanly
              if (room.isHost) {
                writeRemote('', room.state, 'PUT');
              }
              setStatus('connected');
              return;
            }
            applyPathMutation(room.state, p, msg.data, isPatch);
            persistLocalSnap(room);
            setStatus('connected');
            notifyUpdate(p);
          } catch (_) {}
        };

        es.addEventListener('put', handleSse(false));
        es.addEventListener('patch', handleSse(true));
        es.onopen = () => {
          if (active && active.roomId === room.roomId) setStatus('connected');
        };
        es.onerror = () => {
          if (!active || active.roomId !== room.roomId) return;
          if (es.readyState === EventSource.CLOSED) {
            setStatus('error');
            startFallbackPoll();
          }
        };
      } catch (_) {
        startFallbackPoll();
      }
    } else {
      startFallbackPoll();
    }
  }

  function startPresenceHeartbeat(room) {
    const beat = () => {
      if (!active || active.roomId !== room.roomId) return;
      writeRemote(`presence/${clientId}`, {
        uid: room.user.uid,
        name: room.user.name,
        role: room.user.role,
        color: room.user.color,
        lastSeen: Date.now()
      }, 'PUT');
    };
    beat();
    room.hbTimer = setInterval(beat, HEARTBEAT_MS);
  }

  function joinRoom({ roomId, passageId, isFull, isHost, dbUrl, user, initialHighlights, initialNotes, initialAnswers, onUpdate, onStatus }) {
    leaveRoom();
    const cleanRoomId = String(roomId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || generateRoomId();
    const resolvedDb = normalizeDbUrl(dbUrl) || getConfiguredDbUrl();
    if (resolvedDb && dbUrl) saveDbUrl(resolvedDb);

    const role = user?.role === 'teacher' ? 'teacher' : 'student';
    const uObj = {
      uid: String(user?.uid || 'guest'),
      name: String(user?.name || (role === 'teacher' ? 'Giáo viên' : 'Học viên')),
      role,
      color: pickUserColor(user?.uid, role)
    };

    const existingSnap = readLocalSnap(cleanRoomId);
    const initState = existingSnap || createEmptyRoomState({
      passageId,
      isFull: !!isFull,
      hostId: isHost ? uObj.uid : '',
      hostName: isHost ? uObj.name : 'Giáo viên',
      permission: 'collab',
      syncAnswers: true,
      revealAnswers: false
    });

    if (isHost && !existingSnap) {
      if (initialHighlights && typeof initialHighlights === 'object') {
        initState.highlights = JSON.parse(JSON.stringify(initialHighlights));
      }
      if (Array.isArray(initialNotes) && initialNotes.length) {
        initState.notes = initialNotes.slice();
      }
      if (initialAnswers && typeof initialAnswers === 'object') {
        Object.keys(initialAnswers).forEach((qid) => {
          const v = initialAnswers[qid];
          if (String(v ?? '').trim()) {
            initState.answers[qid] = { val: v, by: uObj.name, byId: uObj.uid, byClientId: clientId, ts: Date.now() };
          }
        });
      }
    }

    const room = {
      roomId: cleanRoomId,
      passageId: passageId || initState.meta.passageId || '',
      isFull: !!isFull,
      dbUrl: resolvedDb,
      isHost: !!isHost || (initState.meta.hostId && initState.meta.hostId === uObj.uid) || role === 'teacher',
      user: uObj,
      state: initState,
      bc: null,
      es: null,
      pollTimer: null,
      hbTimer: null,
      onUpdate,
      onStatus,
      status: resolvedDb ? 'connecting' : 'local'
    };

    active = room;

    // 1. Bind BroadcastChannel for instant multi-tab sync
    if (typeof BroadcastChannel === 'function') {
      try {
        const bc = new BroadcastChannel('totoro_rp_live_' + cleanRoomId);
        room.bc = bc;
        bc.onmessage = (ev) => {
          const msg = ev?.data;
          if (!msg || msg.sender === clientId || !active || active.roomId !== cleanRoomId) return;
          if (msg.type === 'sync_request') {
            bc.postMessage({ sender: clientId, path: '', method: 'PUT', data: room.state, ts: Date.now() });
            return;
          }
          applyPathMutation(room.state, msg.path || '', msg.data, msg.method === 'PATCH');
          persistLocalSnap(room);
          notifyUpdate(msg.path || '/');
        };
        // Ask any already-open tab for latest state
        bc.postMessage({ sender: clientId, type: 'sync_request', ts: Date.now() });
      } catch (_) {}
    }

    // 2. If host created a brand new room, publish initial state
    if (isHost && !existingSnap) {
      writeRemote('', room.state, 'PUT');
    } else if (existingSnap) {
      notifyUpdate('/');
    }

    // 3. Connect Firebase RTDB SSE stream if URL configured
    startFirebaseStream(room);

    // 4. Start presence heartbeat
    startPresenceHeartbeat(room);

    // 5. Update browser URL cleanly so F5 stays in the same Live room (like Google Docs!)
    try {
      const share = new URL(buildShareUrl());
      window.history.replaceState(null, '', share.pathname + share.search + share.hash);
    } catch (_) {}

    return room;
  }

  function leaveRoom(clearUrl = true) {
    if (!active) return;
    const room = active;
    if (room.hbTimer) clearInterval(room.hbTimer);
    if (room.pollTimer) clearInterval(room.pollTimer);
    if (room.es) {
      try { room.es.close(); } catch (_) {}
    }
    // Remove presence cleanly
    try {
      writeRemote(`presence/${clientId}`, null, 'DELETE', true);
    } catch (_) {}
    if (room.bc) {
      try { room.bc.close(); } catch (_) {}
    }
    active = null;
    if (clearUrl) {
      try {
        const u = new URL(window.location.href);
        if (u.searchParams.has('live')) {
          u.searchParams.delete('live');
          u.searchParams.delete('p');
          u.searchParams.delete('full');
          u.searchParams.delete('db');
          const qs = u.searchParams.toString();
          window.history.replaceState(null, '', u.pathname + (qs ? '?' + qs : '') + u.hash);
        }
      } catch (_) {}
    }
  }

  function buildShareUrl(customRoomId, customPassageId, customIsFull) {
    const rid = customRoomId || active?.roomId || generateRoomId();
    const pid = customPassageId || active?.passageId || '';
    const isFull = typeof customIsFull === 'boolean' ? customIsFull : !!active?.isFull;
    const db = active?.dbUrl || getConfiguredDbUrl();
    const u = new URL(window.location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('live', rid);
    if (pid) u.searchParams.set('p', pid);
    if (isFull) u.searchParams.set('full', '1');
    if (db) u.searchParams.set('db', db.replace(/^https?:\/\//i, ''));
    return u.toString();
  }

  function canLocalUserEdit() {
    if (!active) return true;
    if (active.isHost || active.user.role === 'teacher') return true;
    return active.state?.meta?.permission !== 'watch';
  }

  function getOnlineMembers() {
    if (!active) return [];
    const now = Date.now();
    const pres = active.state?.presence || {};
    const list = [];
    const seenUid = new Set();
    Object.entries(pres).forEach(([cid, m]) => {
      if (!m || !m.name) return;
      if (cid !== clientId && (now - Number(m.lastSeen || 0)) > STALE_PRESENCE_MS) return;
      const key = `${m.uid || cid}_${m.role || ''}`;
      if (seenUid.has(key)) return;
      seenUid.add(key);
      list.push({ ...m, cid, isMe: cid === clientId });
    });
    list.sort((a, b) => (a.role === 'teacher' ? -1 : 1) - (b.role === 'teacher' ? -1 : 1));
    return list;
  }

  function testFirebaseUrl(rawUrl) {
    const clean = normalizeDbUrl(rawUrl);
    if (!clean) {
      return Promise.resolve({ ok: false, msg: 'URL không hợp lệ (cần có đuôi .firebasedatabase.app hoặc .firebaseio.com).' });
    }
    const pingUrl = `${clean}/rp_live/_ping.json`;
    const t0 = Date.now();
    return fetch(pingUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ts: t0 })
    }).then((res) => {
      const ms = Date.now() - t0;
      if (res.ok) return { ok: true, ms, url: clean, msg: `Kết nối Realtime thành công (${ms}ms)!` };
      if (res.status === 401 || res.status === 403) {
        return { ok: false, msg: 'Bị từ chối quyền ghi (401/403). Vào Firebase → Realtime Database → Rules đặt ".read": true, ".write": true cho nhánh "rp_live".' };
      }
      return { ok: false, msg: `Lỗi HTTP ${res.status}. Kiểm tra lại đường dẫn Realtime Database.` };
    }).catch(() => ({ ok: false, msg: 'Không kết nối được tới Firebase (kiểm tra mạng hoặc URL).' }));
  }

  // Capture ?live=...&p=... from URL right at boot (before login redirects/clears anything)
  function capturePendingFromUrl() {
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const roomId = String(sp.get('live') || '').trim();
      const passageId = String(sp.get('p') || '').trim();
      if (!roomId || !passageId) return null;
      const isFull = sp.get('full') === '1';
      const dbRaw = String(sp.get('db') || '').trim();
      const dbUrl = dbRaw ? normalizeDbUrl(dbRaw) : '';
      if (dbUrl) saveDbUrl(dbUrl);
      const rec = { roomId, passageId, isFull, dbUrl };
      sessionStorage.setItem(PENDING_URL_KEY, JSON.stringify(rec));
      return rec;
    } catch (_) {
      return null;
    }
  }

  function peekPendingFromUrl() {
    try {
      const raw = sessionStorage.getItem(PENDING_URL_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return capturePendingFromUrl();
  }

  function clearPendingFromUrl() {
    try { sessionStorage.removeItem(PENDING_URL_KEY); } catch (_) {}
  }

  if (typeof window !== 'undefined') {
    capturePendingFromUrl();
    window.addEventListener('beforeunload', () => {
      if (active) leaveRoom(false);
    });
  }

  window.LiveReadingRoom = {
    getClientId: () => clientId,
    isActive: () => !!active,
    getActive: () => active,
    getConfiguredDbUrl,
    saveDbUrl,
    normalizeDbUrl,
    generateRoomId,
    buildShareUrl,
    canLocalUserEdit,
    getOnlineMembers,
    testFirebaseUrl,
    capturePendingFromUrl,
    peekPendingFromUrl,
    clearPendingFromUrl,
    joinRoom,
    leaveRoom,

    pushHighlights(passageId, hlArray) {
      if (!active || !passageId || !canLocalUserEdit()) return;
      return writeRemote(`highlights/${encodeURIComponent(passageId)}`, Array.isArray(hlArray) ? hlArray : [], 'PUT');
    },
    pushNotes(notesArray) {
      if (!active || !canLocalUserEdit()) return;
      return writeRemote('notes', Array.isArray(notesArray) ? notesArray : [], 'PUT');
    },
    pushAnswer(qid, val) {
      if (!active || !qid || !canLocalUserEdit()) return;
      if (active.state?.meta?.syncAnswers === false) return;
      return writeRemote(`answers/${encodeURIComponent(qid)}`, {
        val: String(val ?? ''),
        by: active.user.name,
        byId: active.user.uid,
        byRole: active.user.role,
        byClientId: clientId,
        ts: Date.now()
      }, 'PUT');
    },
    pushFocus(focusPayload) {
      if (!active || !focusPayload) return;
      if (!canLocalUserEdit()) return;
      return writeRemote('focus', {
        ...focusPayload,
        by: active.user.name,
        byId: active.user.uid,
        byRole: active.user.role,
        byClientId: clientId,
        ts: Date.now()
      }, 'PUT');
    },
    patchMeta(patchObj) {
      if (!active || !patchObj || !active.isHost) return;
      return writeRemote('meta', patchObj, 'PATCH');
    },
    reconnectWithDbUrl(rawUrl) {
      if (!active) return saveDbUrl(rawUrl);
      const clean = saveDbUrl(rawUrl);
      if (!clean) return '';
      const cur = active;
      if (cur.es) { try { cur.es.close(); } catch (_) {} cur.es = null; }
      if (cur.pollTimer) { clearInterval(cur.pollTimer); cur.pollTimer = null; }
      cur.dbUrl = clean;
      writeRemote('', cur.state, 'PUT');
      startFirebaseStream(cur);
      try {
        const share = new URL(buildShareUrl());
        window.history.replaceState(null, '', share.pathname + share.search + share.hash);
      } catch (_) {}
      return clean;
    }
  };
})();
