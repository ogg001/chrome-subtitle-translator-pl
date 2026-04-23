function getYouTubeTitle() {
  const selectors = [
    "h1.ytd-watch-metadata",
    "yt-formatted-string.style-scope.ytd-watch-metadata",
    "h1.title"
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    const text = el?.textContent?.trim();

    if (text) {
      return text;
    }
  }

  return document.title || null;
}

function getVideoInfo() {
  const video = document.querySelector("video");

  if (!video) {
    return {
      foundVideo: false,
      textTracksCount: 0
    };
  }

  return {
    foundVideo: true,
    textTracksCount: video.textTracks?.length ?? 0
  };
}

function getCaptionInfo() {
  const container =
    document.querySelector(".ytp-caption-window-container") ||
    document.querySelector(".captions-text") ||
    document.querySelector(".ytp-caption-segment");

  const segments = Array.from(document.querySelectorAll(".ytp-caption-segment"));

  const captionText = segments
    .map((el) => el.textContent?.trim())
    .filter(Boolean)
    .join(" ");

  return {
    foundCaptionContainer: !!container,
    captionText: captionText || "Nie znaleziono aktualnego tekstu napisów."
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_YT_VIDEO_INFO") {
    const title = getYouTubeTitle();
    const videoInfo = getVideoInfo();
    const captionInfo = getCaptionInfo();

    sendResponse({
      ok: true,
      title: title || "Nie znaleziono tytułu filmu.",
      foundVideo: videoInfo.foundVideo,
      textTracksCount: videoInfo.textTracksCount,
      foundCaptionContainer: captionInfo.foundCaptionContainer,
      captionText: captionInfo.captionText
    });
  }

  return true;
});