const titleElement = document.getElementById("title");

async function loadVideoTitle() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!tab?.id) {
      titleElement.textContent = "Nie udało się znaleźć aktywnej karty.";
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "GET_VIDEO_TITLE"
    });

    titleElement.textContent = response?.title || "Brak odpowiedzi ze strony.";
  } catch (error) {
    titleElement.textContent = "Otwórz stronę filmu na YouTube.";
    console.error(error);
  }
}

loadVideoTitle();