window.PDFAIBookmarks_Preferences = {
    init: function () {
        Zotero.debug("PDF AI Bookmarks: Initialize preference pane");

        const apiKeyInput = document.getElementById("pdf-ai-bookmarks-api-key");
        const polishCheckbox = document.getElementById("pdf-ai-bookmarks-polish");

        // Load current values
        const currentApiKey = Zotero.Prefs.get('extensions.pdf-ai-bookmarks.apiKey', true);
        const currentPolish = Zotero.Prefs.get('extensions.pdf-ai-bookmarks.polish', true);

        if (currentApiKey) {
            apiKeyInput.value = currentApiKey;
        }

        if (currentPolish !== undefined) {
            polishCheckbox.checked = currentPolish;
        } else {
            polishCheckbox.checked = true; // default
        }

        // Auto-save on change
        apiKeyInput.addEventListener("input", (e) => {
            Zotero.Prefs.set('extensions.pdf-ai-bookmarks.apiKey', e.target.value, true);
        });

        polishCheckbox.addEventListener("command", (e) => {
            Zotero.Prefs.set('extensions.pdf-ai-bookmarks.polish', e.target.checked, true);
        });
    }
};
