/*
 * P×T online transport.
 *
 * Tries the native WebSocket endpoint first (the bundled Node relay). When the
 * page is hosted statically and no relay exists, it falls back to an MQTT
 * pub/sub relay on a public broker. Matchmaking and the authoritative game
 * loop then run in the browser of the player who creates the room.
 */
(function () {
  'use strict';

  var NativeWS = window.WebSocket;
  var mqtt = window.mqtt;
  if (!NativeWS || !mqtt || typeof mqtt.connect !== 'function') {
    if (NativeWS) window.PXTWebSocket = NativeWS;
    return;
  }

  var PREFIX = 'pxt/v2/';
  var LOBBY = PREFIX + 'lobby';
  var BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
  var BOT_WAIT_MS = 6000;
  var PEER_TTL_MS = 15000;
  var HB_MS = 3000;
  var HB_TIMEOUT_MS = 12000;

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function parse(raw) {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function cleanText(value, max) {
    return String(value || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
  }

  function isGmail(value) {
    return /^[^\s@]+@gmail\.com$/i.test(String(value || '').trim());
  }

  function randomMove() {
    return ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
  }

  function moveIndex(move) {
    return move === 'rock' ? 0 : move === 'paper' ? 1 : 2;
  }

  function PXTWebSocket(url, protocols) {
    this.url = url || '';
    this.protocols = protocols;
    this.readyState = 0;
    this.id = 'p' + uid();
    this.name = 'JOGADOR';
    this.email = '';
    this.peers = new Map();
    this.queued = false;
    this.roomId = null;
    this.isHost = false;
    this.peerId = null;
    this.peerName = 'JOGADOR';
    this._listeners = Object.create(null);
    this._cooldown = Object.create(null);
    this._roomTopics = Object.create(null);
    this._closed = false;
    this._native = null;
    this._useNative = false;
    this._started = false;
    this._brokerReady = false;
    this._initNative();
    try { (window.__pxtSockets || (window.__pxtSockets = [])).push(this); } catch (e) {}
  }

  PXTWebSocket.CONNECTING = 0;
  PXTWebSocket.OPEN = 1;
  PXTWebSocket.CLOSING = 2;
  PXTWebSocket.CLOSED = 3;

  PXTWebSocket.prototype.addEventListener = function (type, fn, opts) {
    if (typeof fn !== 'function') return;
    var list = this._listeners[type] || (this._listeners[type] = []);
    list.push({ fn: fn, once: !!(opts && opts.once) });
  };

  PXTWebSocket.prototype.removeEventListener = function (type, fn) {
    var list = this._listeners[type];
    if (!list) return;
    this._listeners[type] = list.filter(function (entry) { return entry.fn !== fn; });
  };

  PXTWebSocket.prototype._fire = function (type, event) {
    var list = this._listeners[type];
    if (list && list.length) {
      list = list.slice();
      for (var i = 0; i < list.length; i++) {
        var entry = list[i];
        if (entry.once) this.removeEventListener(type, entry.fn);
        try { entry.fn.call(this, event); } catch (err) { try { console.error(err); } catch (e) {} }
      }
    }
    var prop = 'on' + type;
    if (typeof this[prop] === 'function') {
      try { this[prop].call(this, event); } catch (e) {}
    }
  };

  Object.defineProperty(PXTWebSocket.prototype, 'binaryType', {
    get: function () { return this._binaryType || 'blob'; },
    set: function (value) {
      this._binaryType = value;
      if (this._native) { try { this._native.binaryType = value; } catch (e) {} }
    }
  });

  PXTWebSocket.prototype._initNative = function () {
    var self = this;
    if (!this.url || !/^wss?:\/\//i.test(String(this.url))) {
      this._startP2P();
      return;
    }
    var native;
    try {
      native = this.protocols ? new NativeWS(this.url, this.protocols) : new NativeWS(this.url);
    } catch (e) {
      this._startP2P();
      return;
    }
    this._native = native;
    if (this._binaryType) { try { native.binaryType = this._binaryType; } catch (e) {} }
    var opened = false;
    var timer = setTimeout(function () {
      if (!opened && !self._closed) self._startP2P();
    }, 4000);
    this._nativeTimer = timer;

    native.addEventListener('open', function () {
      if (self._closed || self._started) { try { native.close(); } catch (e) {} return; }
      opened = true;
      clearTimeout(timer);
      self._useNative = true;
      self.readyState = 1;
      self._fire('open', {});
    });
    native.addEventListener('message', function (event) {
      if (self._useNative && !self._closed) self._fire('message', { data: event.data });
    });
    native.addEventListener('error', function () {
      if (!opened && !self._closed) self._startP2P();
    });
    native.addEventListener('close', function () {
      if (!opened) {
        if (!self._closed) self._startP2P();
        return;
      }
      if (self._closed) return;
      self._useNative = false;
      self.readyState = 3;
      self._fire('close', {});
    });
  };

  PXTWebSocket.prototype._startP2P = function () {
    if (this._started || this._closed) return;
    this._started = true;
    if (this._nativeTimer) { clearTimeout(this._nativeTimer); this._nativeTimer = null; }
    if (this._native) { try { this._native.close(); } catch (e) {} this._native = null; }
    this._connectBroker(0);
  };

  PXTWebSocket.prototype._connectBroker = function (index) {
    var self = this;
    if (this._closed) return;
    if (index >= BROKERS.length) { this._failP2P(); return; }
    var client;
    try {
      client = mqtt.connect(BROKERS[index], {
        clientId: 'pxt_' + this.id + '_' + Math.random().toString(16).slice(2, 8),
        keepalive: 30,
        clean: true,
        reconnectPeriod: 0,
        connectTimeout: 10000,
        protocolVersion: 4
      });
    } catch (e) {
      this._connectBroker(index + 1);
      return;
    }
    this._mqtt = client;
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      try { client.end(true); } catch (e) {}
      self._connectBroker(index + 1);
    }, 12000);

    client.on('connect', function () {
      if (settled) { try { client.end(true); } catch (e) {} return; }
      settled = true;
      clearTimeout(timer);
      self._onBrokerConnect(client);
    });
    client.on('close', function () {
      if (self._closed) return;
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        self._connectBroker(index + 1);
        return;
      }
      if (self._brokerReady) self._onBrokerDown();
    });
    client.on('error', function () {});
    client.on('message', function (topic, payload) {
      if (self._brokerReady) self._onBrokerMessage(topic, payload.toString());
    });
  };

  PXTWebSocket.prototype._onBrokerConnect = function (client) {
    if (this._closed) { try { client.end(true); } catch (e) {} return; }
    var self = this;
    this._brokerReady = true;
    this._lobbyTopic = LOBBY;
    this._inboxTopic = PREFIX + 'inbox/' + this.id;
    client.subscribe([this._lobbyTopic, this._inboxTopic], { qos: 0 }, function () {
      if (self._closed) return;
      self.readyState = 1;
      self._publishLobby();
      self._fire('open', {});
      self._sendOnline();
    });
    this._presenceTimer = setInterval(function () { self._publishLobby(); self._sendOnline(); }, 2500);
    this._heartbeatTimer = setInterval(function () { self._sendHeartbeat(); self._checkPeers(); }, HB_MS);
    this._scheduleBot();
  };

  PXTWebSocket.prototype._onBrokerDown = function () {
    if (this._closed) return;
    this._brokerReady = false;
    this.readyState = 3;
    this._clearTimers();
    if (this._mqtt) { try { this._mqtt.end(true); } catch (e) {} }
    this._fire('close', {});
  };

  PXTWebSocket.prototype._failP2P = function () {
    if (this._closed) return;
    this._closed = true;
    this.readyState = 3;
    this._clearTimers();
    this._fire('error', {});
    this._fire('close', {});
  };

  PXTWebSocket.prototype._publish = function (topic, payload) {
    if (!this._mqtt || !this._brokerReady) return;
    try { this._mqtt.publish(topic, JSON.stringify(payload), { qos: 0 }); } catch (e) {}
  };

  PXTWebSocket.prototype._publishLobby = function () {
    if (!this._brokerReady) return;
    this._publish(LOBBY, {
      k: 'presence',
      id: this.id,
      name: this.name,
      q: this.queued ? 1 : 0,
      ts: Date.now()
    });
  };

  PXTWebSocket.prototype._sendOnline = function () {
    var now = Date.now();
    var count = 1;
    this.peers.forEach(function (peer) {
      if (now - peer.lastSeen <= PEER_TTL_MS) count++;
    });
    this._deliver({ type: 'online', count: count });
  };

  PXTWebSocket.prototype._sendQueued = function (position) {
    this._deliver({ type: 'queued', position: position || 1, queue: 1 });
  };

  PXTWebSocket.prototype._onBrokerMessage = function (topic, raw) {
    var msg = parse(raw);
    if (!msg) return;
    if (topic === this._lobbyTopic) this._onLobby(msg);
    else if (topic === this._inboxTopic) this._onInbox(msg);
    else {
      var room = this.roomId || (this._pendingInvite && this._pendingInvite.room);
      if (room && topic === PREFIX + 'room/' + room) this._onRoom(msg);
    }
  };

  PXTWebSocket.prototype._onLobby = function (msg) {
    if (!msg || msg.id === this.id || msg.k !== 'presence') return;
    var peer = this.peers.get(msg.id) || { id: msg.id, qAt: 0, lastSeen: 0, q: false };
    peer.name = cleanText(msg.name, 18) || peer.name || 'JOGADOR';
    peer.lastSeen = Date.now();
    peer.q = !!msg.q;
    if (peer.q && !peer.qAt) peer.qAt = Number(msg.ts) || Date.now();
    if (!peer.q) peer.qAt = 0;
    this.peers.set(msg.id, peer);
    if (peer.q) this._maybeInvite();
  };

  PXTWebSocket.prototype._maybeInvite = function () {
    if (!this.queued || this.roomId || this._pendingInvite || this._joinWait || this._closed) return;
    var now = Date.now();
    var best = null;
    var self = this;
    this.peers.forEach(function (peer) {
      if (!peer.q || now - peer.lastSeen > PEER_TTL_MS) return;
      if (peer.id <= self.id) return;
      if ((self._cooldown[peer.id] || 0) > now) return;
      if (!best || (peer.qAt || 0) < (best.qAt || 0)) best = peer;
    });
    if (best) this._invite(best);
  };

  PXTWebSocket.prototype._invite = function (peer) {
    var self = this;
    var room = 'r' + uid();
    var pending = this._pendingInvite = { peer: peer, room: room };
    this._subscribeRoom(room);
    var sendInvite = function () {
      if (!self._pendingInvite || self._pendingInvite.room !== room) return;
      self._publish(PREFIX + 'inbox/' + peer.id, {
        k: 'invite',
        from: self.id,
        room: room,
        name: self.name,
        ts: Date.now()
      });
    };
    sendInvite();
    pending.retry = setTimeout(sendInvite, 900);
    pending.timer = setTimeout(function () {
      if (!self._pendingInvite || self._pendingInvite.room !== room) return;
      clearTimeout(pending.retry);
      self._pendingInvite = null;
      self._cooldown[peer.id] = Date.now() + 8000;
      self._unsubscribeRoom(room);
      self._sendQueued(1);
      self._maybeInvite();
    }, 6000);
    this._sendQueued(1);
  };

  PXTWebSocket.prototype._onInbox = function (msg) {
    if (!msg || msg.k !== 'invite' || msg.from === this.id) return;
    if (!this.queued || this.roomId || this._joinWait || this._pendingInvite) return;
    var self = this;
    this.roomId = msg.room;
    this.isHost = false;
    this.peerId = msg.from;
    this.peerName = cleanText(msg.name, 18) || 'JOGADOR';
    this._peerHb = Date.now();
    this._joinWait = { room: msg.room, hostId: msg.from };
    this._subscribeRoom(msg.room);
    this._publish(PREFIX + 'room/' + msg.room, {
      k: 'join',
      from: this.id,
      name: this.name,
      ts: Date.now()
    });
    this.queued = false;
    this._publishLobby();
    this._sendQueued(1);
    this._joinWait.timer = setTimeout(function () {
      if (!self._joinWait || self._joinWait.room !== msg.room) return;
      self._joinWait = null;
      self._resetRoomState();
      self._queueAgain();
    }, 9000);
  };

  PXTWebSocket.prototype._onRoom = function (msg) {
    if (!msg) return;
    if (msg.k === 'join') {
      if (!this._pendingInvite || msg.from !== this._pendingInvite.peer.id) return;
      clearTimeout(this._pendingInvite.timer);
      clearTimeout(this._pendingInvite.retry);
      this.roomId = this._pendingInvite.room;
      this.isHost = true;
      this.peerId = msg.from;
      this.peerName = cleanText(msg.name, 18) || this._pendingInvite.peer.name || 'JOGADOR';
      this._pendingInvite = null;
      this._peerHb = Date.now();
      this.queued = false;
      this._publishLobby();
      this._scheduleBot();
      this._startHost();
      return;
    }
    if (msg.k === 'hb') {
      if (msg.from === this.peerId) this._peerHb = Date.now();
      return;
    }
    if (msg.k === 'msg') {
      if (msg.to && msg.to !== this.id) return;
      if (this.isHost) {
        if (this._engine && msg.from === this.peerId) this._engine.handleRemote(JSON.stringify(msg.m));
      } else if (msg.from === this.peerId) {
        if (this._joinWait && msg.m && msg.m.type === 'matched') this._joinWait = null;
        this._deliver(msg.m);
      }
      return;
    }
    if (msg.k === 'bye') {
      if (this.isHost) {
        if (this._engine) this._engine.handleRemote(JSON.stringify({ type: 'leave' }));
      } else {
        this._remoteGone();
      }
    }
  };

  PXTWebSocket.prototype._subscribeRoom = function (room) {
    if (!room) return;
    this._roomTopics[room] = true;
    if (!this._mqtt || !this._brokerReady) return;
    try { this._mqtt.subscribe(PREFIX + 'room/' + room, { qos: 0 }); } catch (e) {}
  };

  PXTWebSocket.prototype._unsubscribeRoom = function (room) {
    if (!room) return;
    delete this._roomTopics[room];
    if (!this._mqtt || !this._brokerReady) return;
    try { this._mqtt.unsubscribe(PREFIX + 'room/' + room); } catch (e) {}
  };

  PXTWebSocket.prototype._sendRoomMessage = function (obj) {
    if (!this.roomId || this.peerId === null) return;
    this._publish(PREFIX + 'room/' + this.roomId, {
      k: 'msg',
      from: this.id,
      to: this.peerId,
      m: obj,
      ts: Date.now()
    });
  };

  PXTWebSocket.prototype._sendHeartbeat = function () {
    if (!this.roomId || this.roomId.indexOf('bot') === 0 || this.peerId === null) return;
    this._publish(PREFIX + 'room/' + this.roomId, { k: 'hb', from: this.id, ts: Date.now() });
  };

  PXTWebSocket.prototype._checkPeers = function () {
    var now = Date.now();
    var self = this;
    this.peers.forEach(function (peer, id) {
      if (now - peer.lastSeen > PEER_TTL_MS) self.peers.delete(id);
    });
    if (this.roomId && this.roomId.indexOf('bot') !== 0 && this.peerId !== null) {
      if (this._peerHb && now - this._peerHb > HB_TIMEOUT_MS) this._peerLost();
    }
  };

  PXTWebSocket.prototype._peerLost = function () {
    if (this.isHost) {
      if (this._engine) this._engine.handleRemote(JSON.stringify({ type: 'leave' }));
    } else {
      this._remoteGone();
    }
  };

  PXTWebSocket.prototype._remoteGone = function () {
    this._deliver({ type: 'opponentLeft' });
    this._resetRoomState();
  };

  PXTWebSocket.prototype._scheduleBot = function () {
    var self = this;
    clearTimeout(this._botTimer);
    this._botTimer = setTimeout(function () {
      if (!self.queued) return;
      if (self._pendingInvite || self._joinWait || self.roomId) {
        self._scheduleBot();
        return;
      }
      self._startBot();
    }, BOT_WAIT_MS);
  };

  PXTWebSocket.prototype._queueAgain = function () {
    if (this._closed || !this._brokerReady) return;
    this.queued = true;
    this._queueAt = Date.now();
    this._cooldown = Object.create(null);
    this._publishLobby();
    this._sendQueued(1);
    this._scheduleBot();
    this._maybeInvite();
  };

  PXTWebSocket.prototype._handleQueue = function (msg) {
    if (msg.name) this.name = cleanText(msg.name, 18) || this.name;
    if (msg.email) this.email = cleanText(msg.email, 80) || this.email;
    if (!isGmail(this.email)) {
      this._deliver({ type: 'error', code: 'GMAIL_REQUIRED', message: 'Faça login com Gmail para jogar online.' });
      return;
    }
    if (this.roomId) {
      this._deliver({ type: 'error', message: 'Você já está em uma partida.' });
      return;
    }
    if (this.queued) {
      this._sendQueued(1);
      return;
    }
    this.queued = true;
    this._queueAt = Date.now();
    this._cooldown = Object.create(null);
    this._publishLobby();
    this._sendQueued(1);
    this._scheduleBot();
    this._maybeInvite();
  };

  PXTWebSocket.prototype._handleCancel = function () {
    var self = this;
    this.queued = false;
    clearTimeout(this._botTimer);
    if (this._pendingInvite) {
      clearTimeout(this._pendingInvite.timer);
      clearTimeout(this._pendingInvite.retry);
      this._unsubscribeRoom(this._pendingInvite.room);
      this._pendingInvite = null;
    }
    if (this._joinWait) {
      clearTimeout(this._joinWait.timer);
      this._unsubscribeRoom(this.roomId);
      this._joinWait = null;
      this._resetRoomState();
    }
    this._publishLobby();
    this._deliver({ type: 'cancelled' });
    self._sendOnline();
  };

  PXTWebSocket.prototype._makeVirtual = function (isLocal) {
    var self = this;
    return {
      readyState: 1,
      name: '',
      email: '',
      room: null,
      seat: null,
      queued: false,
      isBot: false,
      send: function (raw) {
        var obj = typeof raw === 'string' ? parse(raw) : raw;
        if (!obj) return;
        if (isLocal) self._deliver(obj);
        else self._sendRoomMessage(obj);
      }
    };
  };

  PXTWebSocket.prototype._makeBot = function (engine) {
    var bot = {
      playerId: 'bot' + uid(),
      name: 'BOT_TREINO',
      email: 'bot@pxt.local',
      room: null,
      seat: null,
      queued: false,
      isBot: true,
      readyState: 1,
      moveTimer: null,
      send: function (raw) {
        var msg = parse(raw);
        if (!msg) return;
        var room = bot.room;
        if (msg.type === 'round' && room && !room.ended && room.round === msg.round) {
          clearTimeout(bot.moveTimer);
          bot.moveTimer = setTimeout(function () {
            if (room.ended || room.round !== msg.round || room.moves[bot.seat] !== null) return;
            room.moves[bot.seat] = randomMove();
            if (room.moves[0] && room.moves[1]) engine.resolveRound(room, false);
          }, 700 + Math.random() * 1200);
        } else if (msg.type === 'end' || msg.type === 'opponentLeft' || msg.type === 'left') {
          clearTimeout(bot.moveTimer);
          bot.moveTimer = null;
        }
      }
    };
    return bot;
  };

  PXTWebSocket.prototype._startHost = function () {
    if (this._engine) return;
    var local = this._makeVirtual(true);
    local.name = this.name;
    local.email = 'local@gmail.com';
    var remote = this._makeVirtual(false);
    remote.name = this.peerName;
    remote.email = 'peer@gmail.com';
    this._localSocket = local;
    this._remoteSocket = remote;
    this._engine = new HostEngine(this, local, remote);
    this._engine.start();
  };

  PXTWebSocket.prototype._startBot = function () {
    if (!this.queued || this.roomId) return;
    this.queued = false;
    this._publishLobby();
    this.roomId = 'bot' + uid();
    this.isHost = true;
    this.peerId = 'bot';
    this.peerName = 'BOT_TREINO';
    var local = this._makeVirtual(true);
    local.name = this.name;
    local.email = 'local@gmail.com';
    var engine = new HostEngine(this, local, null);
    engine.remote = this._makeBot(engine);
    this._localSocket = local;
    this._remoteSocket = engine.remote;
    this._engine = engine;
    engine.start();
  };

  PXTWebSocket.prototype._deliver = function (obj) {
    if (!obj) return;
    this._fire('message', { data: JSON.stringify(obj) });
    if (obj.type === 'end' || obj.type === 'opponentLeft' || obj.type === 'left') {
      var self = this;
      setTimeout(function () { self._resetRoomState(); }, 0);
    }
  };

  PXTWebSocket.prototype._resetRoomState = function () {
    if (this.roomId) this._unsubscribeRoom(this.roomId);
    if (this._engine) { this._engine.destroy(); this._engine = null; }
    this.roomId = null;
    this.isHost = false;
    this.peerId = null;
    this.peerName = 'JOGADOR';
    this._peerHb = 0;
    this._localSocket = null;
    this._remoteSocket = null;
    this._joinWait = null;
    this._pendingInvite = null;
    this._publishLobby();
  };

  PXTWebSocket.prototype._clearTimers = function () {
    clearInterval(this._presenceTimer);
    clearInterval(this._heartbeatTimer);
    clearTimeout(this._botTimer);
    clearTimeout(this._endTimer);
    if (this._pendingInvite) {
      clearTimeout(this._pendingInvite.timer);
      clearTimeout(this._pendingInvite.retry);
    }
    if (this._joinWait) clearTimeout(this._joinWait.timer);
    if (this._engine) { this._engine.destroy(); this._engine = null; }
  };

  PXTWebSocket.prototype.send = function (raw) {
    if (this._closed) return;
    if (this._useNative) { try { this._native.send(raw); } catch (e) {} return; }
    var msg = parse(raw);
    if (!msg) return;
    if (msg.type === 'hello') {
      if (msg.name) this.name = cleanText(msg.name, 18) || this.name;
      if (msg.email) this.email = cleanText(msg.email, 80) || this.email;
      this._deliver({ type: 'hello', id: this.id, name: this.name, online: 1 + this.peers.size });
      return;
    }
    if (msg.type === 'ping') { this._deliver({ type: 'pong', t: Date.now() }); return; }
    if (!this._brokerReady) return;
    if (msg.type === 'queue') { this._handleQueue(msg); return; }
    if (msg.type === 'cancel') { this._handleCancel(); return; }
    if (this.roomId) {
      if (this.isHost) {
        if (this._engine && this.roomId.indexOf('bot') !== 0) this._engine.handleLocal(raw);
      } else {
        this._sendRoomMessage(msg);
      }
    }
  };

  PXTWebSocket.prototype.close = function () {
    if (this._closed) return;
    this._closed = true;
    this.readyState = 3;
    if (this._brokerReady) {
      if (this.queued) { this.queued = false; this._publishLobby(); }
      if (this.roomId && this.roomId.indexOf('bot') !== 0) {
        if (this.isHost) {
          if (this._engine) this._engine.handleLocal(JSON.stringify({ type: 'leave' }));
        } else if (this.peerId !== null) {
          this._publish(PREFIX + 'room/' + this.roomId, { k: 'bye', from: this.id, ts: Date.now() });
        }
      }
    }
    this._clearTimers();
    if (this._mqtt) { try { this._mqtt.end(true); } catch (e) {} }
    if (this._native) { try { this._native.close(); } catch (e) {} }
    this._fire('close', {});
  };

  /* Authoritative game loop for the host browser. */
  function HostEngine(shim, local, remote) {
    this.shim = shim;
    this.local = local;
    this.remote = remote;
    this.room = null;
    this.roomSeq = 0;
    this.botSeq = 0;
  }

  HostEngine.prototype.start = function () {
    this.makeRoom(this.local, this.remote);
  };

  HostEngine.prototype.destroy = function () {
    if (this.room) {
      clearTimeout(this.room.timer);
      this.room.ended = true;
      this.room = null;
    }
  };

  HostEngine.prototype.send = function (ws, data) {
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify(data)); } catch (e) {}
    }
  };

  HostEngine.prototype.makeRoom = function (one, two) {
    var self = this;
    var room = {
      id: 'r' + (++this.roomSeq),
      players: [one, two],
      scores: [0, 0],
      round: 0,
      moves: [null, null],
      ready: [false, false],
      timer: null,
      started: false,
      ended: false
    };
    one.room = room;
    two.room = room;
    one.seat = 0;
    two.seat = 1;
    if (one.isBot) room.ready[0] = true;
    if (two.isBot) room.ready[1] = true;
    this.room = room;
    this.send(one, { type: 'matched', roomId: room.id, opponent: { name: two.name || 'JOGADOR', bot: !!two.isBot }, seat: 0, bestOf: 5 });
    this.send(two, { type: 'matched', roomId: room.id, opponent: { name: one.name || 'JOGADOR', bot: !!one.isBot }, seat: 1, bestOf: 5 });
    room.timer = setTimeout(function () {
      if (!room.started && !room.ended) {
        room.started = true;
        self.startRound(room);
      }
    }, 2200);
  };

  HostEngine.prototype.startRound = function (room) {
    if (room.ended) return;
    var self = this;
    room.round += 1;
    room.moves = [null, null];
    room.resolving = false;
    room.deadline = Date.now() + 4000;
    var payload = {
      type: 'round',
      round: room.round,
      scores: room.scores.slice(),
      duration: 4000,
      deadline: room.deadline
    };
    this.send(room.players[0], payload);
    this.send(room.players[1], payload);
    clearTimeout(room.timer);
    room.timer = setTimeout(function () { self.resolveRound(room, true); }, 4000);
  };

  HostEngine.prototype.resolveRound = function (room, auto) {
    if (room.ended || room.resolving) return;
    var self = this;
    room.resolving = true;
    clearTimeout(room.timer);
    room.timer = null;
    room.moves = room.moves.map(function (move) { return move || randomMove(); });
    var a = moveIndex(room.moves[0]);
    var b = moveIndex(room.moves[1]);
    var diff = (a - b + 3) % 3;
    var results = ['draw', 'draw'];
    if (diff === 1) {
      room.scores[0] += 1;
      results = ['win', 'lose'];
    } else if (diff === 2) {
      room.scores[1] += 1;
      results = ['lose', 'win'];
    }
    var payload = {
      type: 'reveal',
      round: room.round,
      moves: room.moves.slice(),
      result: results,
      scores: room.scores.slice(),
      auto: !!auto
    };
    this.send(room.players[0], payload);
    this.send(room.players[1], payload);
    if (room.scores[0] >= 3 || room.scores[1] >= 3) {
      room.timer = setTimeout(function () { self.endRoom(room); }, 1400);
    } else {
      room.timer = setTimeout(function () { self.startRound(room); }, 1600);
    }
  };

  HostEngine.prototype.endRoom = function (room, reason) {
    if (room.ended) return;
    room.ended = true;
    clearTimeout(room.timer);
    room.timer = null;
    var winner = reason === 'disconnect' ? null : (room.scores[0] >= 3 ? 0 : 1);
    room.players.forEach(function (ws, index) {
      if (!ws) return;
      this.send(ws, {
        type: 'end',
        scores: room.scores.slice(),
        winner: winner === null ? null : (winner === index ? 1 : 0),
        youWon: winner === null ? null : winner === index,
        reason: reason || 'finished'
      });
      ws.room = null;
      ws.seat = null;
    }, this);
    if (this.room === room) this.room = null;
    if (reason === 'disconnect') {
      room.players.forEach(function (ws) {
        if (ws && ws.readyState === 1) this.send(ws, { type: 'opponentLeft' });
      }, this);
    }
  };

  HostEngine.prototype.leaveRoom = function (ws, reason) {
    var room = ws.room;
    ws.room = null;
    ws.seat = null;
    if (!room) return;
    clearTimeout(room.timer);
    room.timer = null;
    room.ended = true;
    var other = null;
    for (var i = 0; i < room.players.length; i++) {
      if (room.players[i] && room.players[i] !== ws) { other = room.players[i]; break; }
    }
    if (other) {
      other.room = null;
      other.seat = null;
      this.send(other, { type: 'opponentLeft' });
    }
    if (this.room === room) this.room = null;
  };

  HostEngine.prototype.handleMessage = function (ws, raw) {
    if (raw.length > 4096) return;
    var msg = parse(raw);
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'ready') {
      var room = ws.room;
      if (!room || room.started || room.ended) return;
      room.ready[ws.seat] = true;
      if (room.ready[0] && room.ready[1]) {
        clearTimeout(room.timer);
        room.started = true;
        this.startRound(room);
      }
      return;
    }
    if (msg.type === 'move') {
      var current = ws.room;
      if (!isGmail(ws.email)) return;
      if (!current || current.ended || current.resolving || ws.seat === null) return;
      if (current.round < 1 || current.moves[ws.seat] !== null) return;
      if (['rock', 'paper', 'scissors'].indexOf(msg.move) < 0) return;
      current.moves[ws.seat] = msg.move;
      if (current.moves[0] && current.moves[1]) this.resolveRound(current, false);
      return;
    }
    if (msg.type === 'leave') {
      this.leaveRoom(ws, 'leave');
    }
  };

  HostEngine.prototype.handleLocal = function (raw) {
    this.handleMessage(this.local, raw);
  };

  HostEngine.prototype.handleRemote = function (raw) {
    this.handleMessage(this.remote, raw);
  };

  window.PXTWebSocket = PXTWebSocket;
})();
