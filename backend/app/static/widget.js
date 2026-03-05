(function () {
    const script = document.currentScript || document.querySelector("script[data-token]");
    console.log("[Bouldy] script element:", script);
    const token = script ? script.getAttribute("data-token") : null;
    const apiUrl = script ? (script.getAttribute("data-api-url") || script.src.replace(/\/static\/widget\.js.*/, "")) : "";
    const chatUrl = script ? (script.getAttribute("data-chat-url") || apiUrl) : "";
  
    console.log("[Bouldy] token:", token, "apiUrl:", apiUrl, "chatUrl:", chatUrl);
  
    if (!token) {
      console.error("[Bouldy] Missing data-token attribute");
      return;
    }
  
    const CHAT_URL = chatUrl + "/chat/" + token;
    const INFO_URL = apiUrl + "/api/public/" + token;
  
    // Default config
    let accentPrimary = "#715A5A";
    let accentSecondary = "#2D2B33";
    let botName = "Chat";
    let hasAvatar = false;
    let avatarUrl = null;
  
    // Fetch chatbot info for branding
    fetch(INFO_URL)
      .then((r) => { console.log("[Bouldy] fetch status:", r.status); return r.json(); })
      .then((data) => {
        console.log("[Bouldy] branding:", data);
        accentPrimary = data.accent_primary || accentPrimary;
        accentSecondary = data.accent_secondary || accentSecondary;
        botName = data.name || botName;
        hasAvatar = data.has_avatar || false;
        avatarUrl = data.avatar_url ? apiUrl + data.avatar_url : null;
        applyBranding();
      })
      .catch((e) => { console.error("[Bouldy] fetch error:", e); });
  
    // Create styles
    const style = document.createElement("style");
    style.textContent = `
      #bouldy-widget-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        z-index: 99998;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      #bouldy-widget-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 24px rgba(0,0,0,0.4);
      }
      #bouldy-widget-btn svg {
        width: 24px;
        height: 24px;
        fill: none;
        stroke: #D3DAD9;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      #bouldy-widget-btn img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
      }
      #bouldy-widget-frame {
        position: fixed;
        bottom: 88px;
        right: 20px;
        width: 400px;
        height: 600px;
        max-height: calc(100vh - 108px);
        max-width: calc(100vw - 40px);
        border: none;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        z-index: 99999;
        display: none;
        overflow: hidden;
      }
      @media (max-width: 480px) {
        #bouldy-widget-frame {
          bottom: 0;
          right: 0;
          width: 100vw;
          height: 100vh;
          max-height: 100vh;
          max-width: 100vw;
          border-radius: 0;
        }
        #bouldy-widget-btn {
          bottom: 16px;
          right: 16px;
        }
      }
    `;
    document.head.appendChild(style);
  
    // Create button
    const btn = document.createElement("button");
    btn.id = "bouldy-widget-btn";
    btn.setAttribute("aria-label", "Open chat");
    btn.style.backgroundColor = accentPrimary;
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    document.body.appendChild(btn);
  
    // Create iframe
    const frame = document.createElement("iframe");
    frame.id = "bouldy-widget-frame";
    frame.src = CHAT_URL;
    frame.setAttribute("allow", "clipboard-write");
    document.body.appendChild(frame);
  
    // Toggle
    let open = false;
    btn.addEventListener("click", function () {
      open = !open;
      frame.style.display = open ? "block" : "none";
      btn.innerHTML = open
        ? `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
        : hasAvatar && avatarUrl
          ? `<img src="${avatarUrl}" alt="${botName}">`
          : `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    });
  
    function applyBranding() {
      btn.style.backgroundColor = accentPrimary;
      if (!open && hasAvatar && avatarUrl) {
        btn.innerHTML = `<img src="${avatarUrl}" alt="${botName}">`;
      }
    }
  })();