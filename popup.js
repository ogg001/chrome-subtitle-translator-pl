const listenerStatusElement = document.getElementById("listener-status");
const playerStatusElement = document.getElementById("player-status");
const videoStatusElement = document.getElementById("video-status");
const captionStatusElement = document.getElementById("caption-status");
const captionTextElement = document.getElementById("caption-text");
const debugInfoElement = document.getElementById("debug-info");
const toggleButtonElement = document.getElementById("toggle-button");

let isListening = false;

function normalize(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function renderState(state) {
  playerStatusElement.textContent = state.foundPlayer ? "znaleziono" : "nie znaleziono";
  videoStatusElement.textContent = state.foundVideo ? "znaleziono" : "nie znaleziono";
  captionStatusElement.textContent = state.foundCaptionContainer ? "znaleziono" : "nie znaleziono";

  if (state.captionText) {
    captionTextElement.textContent = state.captionText;
  }

  debugInfoElement.textContent = [
    `frameUrl=${state.url || "-"}`,
    `bodyId=${state.bodyId || "-"}`,
    `bodyClass=${state.bodyClass || "-"}`,
    `source=${state.source || "-"}`,
    `translatedText=${state.translatedText || "-"}`
  ].join("\n");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id) {
    throw new Error("Brak aktywnej karty.");
  }

  return tab;
}

async function startListening() {
  const tab = await getActiveTab();

  const results = await chrome.scripting.executeScript({
    target: {
      tabId: tab.id,
      allFrames: true
    },
    func: () => {
      function normalize(text) {
        return (text || "").replace(/\s+/g, " ").trim();
      }

      async function translateText(text) {
        // Na razie mock. Później tutaj podepniemy LibreTranslate.
        return `[PL mock] ${text}`;
      }

      function getPlayer() {
        return (
          document.querySelector("#rscpAu-Media") ||
          document.querySelector(".video-js")
        );
      }

      function getVideo() {
        return (
          document.querySelector("#rscpAu-Media_html5_api") ||
          document.querySelector("video.vjs-tech") ||
          document.querySelector("video")
        );
      }

      function getCaptionContainer() {
        return document.querySelector(".vjs-text-track-display");
      }

      function getCaptionText() {
        const captionContainer = getCaptionContainer();
        const captionCue = document.querySelector(".vjs-text-track-cue");

        return normalize(
          captionCue?.innerText ||
          captionContainer?.innerText ||
          ""
        );
      }

      function createTranslationOverlay() {
        let overlay = document.querySelector("#subtitle-translator-overlay");

        if (overlay) {
          return overlay;
        }

        const player = getPlayer();

        if (!player) {
          return null;
        }

        player.style.position = "relative";

        overlay = document.createElement("div");
        overlay.id = "subtitle-translator-overlay";
        overlay.style.position = "absolute";
        overlay.style.left = "5%";
        overlay.style.right = "5%";
        overlay.style.bottom = "78px";
        overlay.style.zIndex = "99999";
        overlay.style.textAlign = "center";
        overlay.style.color = "#ffffff";
        overlay.style.fontSize = "22px";
        overlay.style.fontWeight = "600";
        overlay.style.lineHeight = "1.35";
        overlay.style.textShadow = "2px 2px 4px #000000";
        overlay.style.background = "rgba(0, 0, 0, 0.72)";
        overlay.style.padding = "8px 12px";
        overlay.style.borderRadius = "8px";
        overlay.style.pointerEvents = "none";
        overlay.style.display = "none";

        player.appendChild(overlay);

        return overlay;
      }

      function hideOriginalCaptions() {
        const captionContainer = getCaptionContainer();

        if (captionContainer) {
          captionContainer.style.opacity = "0";
        }
      }

      async function showTranslatedSubtitle(originalText) {
        const overlay = createTranslationOverlay();

        if (!overlay) {
          return "";
        }

        const text = normalize(originalText);

        if (!text) {
          overlay.textContent = "";
          overlay.style.display = "none";
          return "";
        }

        const translatedText = await translateText(text);

        overlay.textContent = translatedText;
        overlay.style.display = "block";

        return translatedText;
      }

      function collectState(source) {
        const player = getPlayer();
        const video = getVideo();
        const captionContainer = getCaptionContainer();
        const captionText = getCaptionText();

        return {
          type: "SUBTITLE_STATE",
          source,
          url: location.href,
          bodyId: document.body?.id || "",
          bodyClass: document.body?.className || "",
          foundPlayer: !!player,
          foundVideo: !!video,
          foundCaptionContainer: !!captionContainer,
          captionText
        };
      }

      const player = getPlayer();
      const video = getVideo();
      const captionContainer = getCaptionContainer();

      if (!player && !video && !captionContainer) {
        return {
          started: false,
          state: collectState("initial-scan")
        };
      }

      if (window.__subtitleTranslatorObserver) {
        window.__subtitleTranslatorObserver.disconnect();
        window.__subtitleTranslatorObserver = null;
      }

      let lastCaptionText = "";

      const sendState = async (source) => {
        const state = collectState(source);
        const currentText = normalize(state.captionText);

        if (!currentText || currentText === lastCaptionText) {
          return;
        }

        lastCaptionText = currentText;

        hideOriginalCaptions();

        const translatedText = await showTranslatedSubtitle(currentText);

        chrome.runtime.sendMessage({
          ...state,
          captionText: currentText,
          translatedText
        });
      };

      if (captionContainer) {
        const observer = new MutationObserver(() => {
          sendState("mutation").catch(console.error);
        });

        observer.observe(captionContainer, {
          childList: true,
          subtree: true,
          characterData: true
        });

        window.__subtitleTranslatorObserver = observer;
      }

      sendState("listener-started").catch(console.error);

      return {
        started: true,
        state: collectState("execute-result")
      };
    }
  });

  const states = results
    .map((item) => item.result?.state)
    .filter(Boolean);

  const best =
    states.find((state) => state.bodyId === "mediaContent") ||
    states.find((state) => state.foundCaptionContainer) ||
    states.find((state) => state.foundVideo) ||
    states.find((state) => state.foundPlayer);

  if (!best) {
    throw new Error("Nie znaleziono playera ani kontenera napisów.");
  }

  renderState(best);

  isListening = true;
  listenerStatusElement.textContent = "włączony";
  toggleButtonElement.textContent = "Stop listening";
}

async function stopListening() {
  const tab = await getActiveTab();

  await chrome.scripting.executeScript({
    target: {
      tabId: tab.id,
      allFrames: true
    },
    func: () => {
      if (window.__subtitleTranslatorObserver) {
        window.__subtitleTranslatorObserver.disconnect();
        window.__subtitleTranslatorObserver = null;
      }

      const overlay = document.querySelector("#subtitle-translator-overlay");

      if (overlay) {
        overlay.remove();
      }

      const captionContainer = document.querySelector(".vjs-text-track-display");

      if (captionContainer) {
        captionContainer.style.opacity = "";
      }

      return true;
    }
  });

  isListening = false;
  listenerStatusElement.textContent = "wyłączony";
  toggleButtonElement.textContent = "Start listening";
  debugInfoElement.textContent = "Listener zatrzymany. Overlay usunięty. Oryginalne napisy przywrócone.";
}

toggleButtonElement.addEventListener("click", async () => {
  try {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  } catch (error) {
    console.error(error);
    debugInfoElement.textContent = `Błąd: ${error?.message || error}`;
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "SUBTITLE_STATE") {
    return;
  }

  const text = normalize(message.captionText);

  renderState({
    ...message,
    captionText: text || "Brak aktualnego tekstu napisów."
  });
});