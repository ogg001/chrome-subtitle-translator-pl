const titleElement = document.getElementById("title");
const videoStatusElement = document.getElementById("video-status");
const tracksCountElement = document.getElementById("tracks-count");
const captionContainerStatusElement = document.getElementById("caption-container-status");
const captionTextElement = document.getElementById("caption-text");
const refreshButtonElement = document.getElementById("refresh-button");

let autoRefreshInterval = null;

async function loadVideoInfo() {
  titleElement.textContent = "Ładowanie...";
  videoStatusElement.textContent = "Ładowanie...";
  tracksCountElement.textContent = "Ładowanie...";
  captionContainerStatusElement.textContent = "Ładowanie...";
  captionTextElement.textContent = "Ładowanie...";

  try {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    const tab = tabs[0];

    if (!tab?.id) {
      titleElement.textContent = "Nie udało się znaleźć aktywnej karty.";
      videoStatusElement.textContent = "-";
      tracksCountElement.textContent = "-";
      captionContainerStatusElement.textContent = "-";
      captionTextElement.textContent = "Brak danych.";
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "GET_YT_VIDEO_INFO"
    });

    if (!response?.ok) {
      titleElement.textContent = "Content script nie zwrócił danych.";
      videoStatusElement.textContent = "-";
      tracksCountElement.textContent = "-";
      captionContainerStatusElement.textContent = "-";
      captionTextElement.textContent = "Brak odpowiedzi z content script.";
      return;
    }

    titleElement.textContent = response.title;
    videoStatusElement.textContent = response.foundVideo ? "znaleziono" : "nie znaleziono";
    tracksCountElement.textContent = String(response.textTracksCount ?? 0);
    captionContainerStatusElement.textContent = response.foundCaptionContainer ? "znaleziono" : "nie znaleziono";
    captionTextElement.textContent = response.captionText || "Brak tekstu napisów.";
  } catch (error) {
    console.error("Popup error:", error);
    titleElement.textContent = "Nie udało się połączyć ze stroną.";
    videoStatusElement.textContent = "-";
    tracksCountElement.textContent = "-";
    captionContainerStatusElement.textContent = "-";
    captionTextElement.textContent =
      "Sprawdź, czy jesteś na stronie filmu YouTube i odświeżyłeś kartę po reloadzie rozszerzenia.";
  }
}

function startAutoRefresh() {
  if (autoRefreshInterval) {
    return;
  }

  loadVideoInfo();
  autoRefreshInterval = setInterval(loadVideoInfo, 1000);
  refreshButtonElement.textContent = "Zatrzymaj auto-refresh";
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }

  refreshButtonElement.textContent = "Uruchom auto-refresh";
}

refreshButtonElement.addEventListener("click", () => {
  if (autoRefreshInterval) {
    stopAutoRefresh();
  } else {
    startAutoRefresh();
  }
});

loadVideoInfo();
refreshButtonElement.textContent = "Uruchom auto-refresh";