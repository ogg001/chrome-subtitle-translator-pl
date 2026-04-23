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

  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_VIDEO_TITLE") {
    const title = getYouTubeTitle();

    sendResponse({
      title: title || "Nie znaleziono tytułu filmu."
    });
  }
});