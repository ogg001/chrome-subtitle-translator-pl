let latestState = {
  foundPlayer: false,
  foundVideo: false,
  foundCaptionContainer: false,
  captionText: "",
  locationHref: "",
  documentTitle: "",
  bodyId: "",
  bodyClass: ""
};

function normalize(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function collectState() {
  const player =
    document.querySelector("#rscpAu-Media") ||
    document.querySelector(".video-js");

  const video =
    document.querySelector("#rscpAu-Media_html5_api") ||
    document.querySelector("video.vjs-tech") ||
    document.querySelector("video");

  const captionContainer =
    document.querySelector(".vjs-text-track-display") ||
    document.querySelector(".vjs-text-track-cue");

  const captionCue = document.querySelector(".vjs-text-track-cue");

  const captionText = normalize(
    captionCue?.innerText ||
    captionContainer?.innerText ||
    ""
  );

  latestState = {
    foundPlayer: !!player,
    foundVideo: !!video,
    foundCaptionContainer: !!captionContainer,
    captionText,
    locationHref: location.href,
    documentTitle: document.title || "",
    bodyId: document.body?.id || "",
    bodyClass: document.body?.className || ""
  };
}

function startWatcher() {
  collectState();

  const observer = new MutationObserver(() => {
    collectState();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  setInterval(collectState, 1000);
}

startWatcher();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_PLAYER_STATE") {
    collectState();

    sendResponse({
      ok: true,
      ...latestState
    });
  }

  return true;
});