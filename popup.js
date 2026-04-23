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
    `source=${state.source || "-"}`
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

      function collectState(source) {
        const player =
          document.querySelector("#rscpAu-Media") ||
          document.querySelector(".video-js");

        const video =
          document.querySelector("#rscpAu-Media_html5_api") ||
          document.querySelector("video.vjs-tech") ||
          document.querySelector("video");

        const captionContainer =
          document.querySelector(".vjs-text-track-display");

        const captionCue =
          document.querySelector(".vjs-text-track-cue");

        const captionText = normalize(
          captionCue?.innerText ||
          captionContainer?.innerText ||
          ""
        );

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

      const captionContainer =
        document.querySelector(".vjs-text-track-display");

      const player =
        document.querySelector("#rscpAu-Media") ||
        document.querySelector(".video-js");

      const video =
        document.querySelector("#rscpAu-Media_html5_api") ||
        document.querySelector("video.vjs-tech") ||
        document.querySelector("video");

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

      const sendState = (source) => {
        chrome.runtime.sendMessage(collectState(source));
      };

      if (captionContainer) {
        const observer = new MutationObserver(() => {
          sendState("mutation");
        });

        observer.observe(captionContainer, {
          childList: true,
          subtree: true,
          characterData: true
        });

        window.__subtitleTranslatorObserver = observer;
      }

      sendState("listener-started");

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

      return true;
    }
  });

  isListening = false;
  listenerStatusElement.textContent = "wyłączony";
  toggleButtonElement.textContent = "Start listening";
  debugInfoElement.textContent = "Listener zatrzymany.";
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