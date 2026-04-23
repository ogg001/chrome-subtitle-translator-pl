const playerStatusElement = document.getElementById("player-status");
const videoStatusElement = document.getElementById("video-status");
const captionStatusElement = document.getElementById("caption-status");
const captionTextElement = document.getElementById("caption-text");
const debugInfoElement = document.getElementById("debug-info");
const refreshButtonElement = document.getElementById("refresh-button");

function setLoading() {
  playerStatusElement.textContent = "Ładowanie...";
  videoStatusElement.textContent = "Ładowanie...";
  captionStatusElement.textContent = "Ładowanie...";
  captionTextElement.textContent = "Ładowanie...";
  debugInfoElement.textContent = "Ładowanie...";
}

function formatFrameDebug(frame, index) {
  return [
    `#${index}`,
    `url=${frame.url || "-"}`,
    `bodyId=${frame.bodyId || "-"}`,
    `bodyClass=${frame.bodyClass || "-"}`,
    `player=${frame.foundPlayer ? "tak" : "nie"}`,
    `video=${frame.foundVideo ? "tak" : "nie"}`,
    `captions=${frame.foundCaptionContainer ? "tak" : "nie"}`,
    `text=${frame.captionText || "-"}`
  ].join(" | ");
}

async function loadState() {
  setLoading();

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!tab?.id) {
      playerStatusElement.textContent = "-";
      videoStatusElement.textContent = "-";
      captionStatusElement.textContent = "-";
      captionTextElement.textContent = "Brak aktywnej karty.";
      debugInfoElement.textContent = "Brak aktywnej karty.";
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        allFrames: true
      },
      func: () => {
        function normalize(text) {
          return (text || "").replace(/\s+/g, " ").trim();
        }

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
          url: location.href,
          title: document.title || "",
          bodyId: document.body?.id || "",
          bodyClass: document.body?.className || "",
          foundPlayer: !!player,
          foundVideo: !!video,
          foundCaptionContainer: !!captionContainer,
          captionText
        };
      }
    });

    const frames = (results || [])
      .map((item) => item.result)
      .filter(Boolean);

    const best =
      frames.find((frame) => frame.bodyId === "mediaContent") ||
      frames.find((frame) => frame.foundCaptionContainer) ||
      frames.find((frame) => frame.foundVideo) ||
      frames.find((frame) => frame.foundPlayer);

    if (!best) {
      playerStatusElement.textContent = "nie znaleziono";
      videoStatusElement.textContent = "nie znaleziono";
      captionStatusElement.textContent = "nie znaleziono";
      captionTextElement.textContent = "Brak aktualnego tekstu napisów.";
      debugInfoElement.textContent = frames.map(formatFrameDebug).join("\n\n") || "Brak frame’ów.";
      return;
    }

    playerStatusElement.textContent = best.foundPlayer ? "znaleziono" : "nie znaleziono";
    videoStatusElement.textContent = best.foundVideo ? "znaleziono" : "nie znaleziono";
    captionStatusElement.textContent = best.foundCaptionContainer ? "znaleziono" : "nie znaleziono";
    captionTextElement.textContent = best.captionText || "Brak aktualnego tekstu napisów.";

    debugInfoElement.textContent = [
      "WYBRANY FRAME:",
      formatFrameDebug(best, "best"),
      "",
      "WSZYSTKIE FRAME’Y:",
      frames.map(formatFrameDebug).join("\n\n")
    ].join("\n");
  } catch (error) {
    console.error("Popup error:", error);
    playerStatusElement.textContent = "-";
    videoStatusElement.textContent = "-";
    captionStatusElement.textContent = "-";
    captionTextElement.textContent = "Błąd przy odczycie danych.";
    debugInfoElement.textContent = `Błąd: ${error?.message || error}`;
  }
}

refreshButtonElement.addEventListener("click", loadState);

loadState();