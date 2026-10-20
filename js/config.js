window.THOM_CONFIG = {
  googleClientId: "",
  screenRelayUrl: "ws://localhost:3003/ws",
  screenRelayRegion: "us-east-1",
  screenRelayKey: "",
  realtimeUrls: [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt",
  ],
  realtimeNamespace: "thomcall-v1",
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};
