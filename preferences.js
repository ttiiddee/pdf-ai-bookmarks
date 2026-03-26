window.PDFAIBookmarks_Preferences = {
    init: function () {
        Zotero.debug("My PDF AI Bookmarks: Initialize preference pane");

        const apiKeyInput = document.getElementById("pdf-ai-bookmarks-api-key");
        const baseUrlInput = document.getElementById("pdf-ai-bookmarks-base-url");
        const modelSelect = document.getElementById("pdf-ai-bookmarks-model");
        const customModelRow = document.getElementById("custom-model-row");
        const customModelInput = document.getElementById("pdf-ai-bookmarks-custom-model");
        const polishCheckbox = document.getElementById("pdf-ai-bookmarks-polish");

        // Load current values
        const currentApiKey = Zotero.Prefs.get('extensions.my-pdf-ai-bookmarks.apiKey', true);
        const currentBaseUrl = Zotero.Prefs.get('extensions.my-pdf-ai-bookmarks.baseUrl', true);
        const currentCustomModel = Zotero.Prefs.get('extensions.my-pdf-ai-bookmarks.customModel', true);
        const currentPolish = Zotero.Prefs.get('extensions.my-pdf-ai-bookmarks.polish', true);

        if (currentApiKey) {
            apiKeyInput.value = currentApiKey;
        }

        if (currentBaseUrl) {
            baseUrlInput.value = currentBaseUrl;
        }

        // Show/hide custom model input - Zotero manages select value via preference attribute
        const updateCustomModelVisibility = () => {
            const isCustom = modelSelect.value === 'custom';
            customModelRow.hidden = !isCustom;
        };

        // Initial visibility update
        updateCustomModelVisibility();

        // Listen for changes to update visibility
        modelSelect.addEventListener("change", updateCustomModelVisibility);

        if (currentCustomModel) {
            customModelInput.value = currentCustomModel;
        }

        if (currentPolish !== undefined) {
            polishCheckbox.checked = currentPolish;
        } else {
            polishCheckbox.checked = true; // default
        }

        // Auto-save on change
        apiKeyInput.addEventListener("input", (e) => {
            Zotero.Prefs.set('extensions.my-pdf-ai-bookmarks.apiKey', e.target.value, true);
        });

        baseUrlInput.addEventListener("input", (e) => {
            Zotero.Prefs.set('extensions.my-pdf-ai-bookmarks.baseUrl', e.target.value, true);
        });

        customModelInput.addEventListener("input", (e) => {
            Zotero.Prefs.set('extensions.my-pdf-ai-bookmarks.customModel', e.target.value, true);
        });

        polishCheckbox.addEventListener("command", (e) => {
            Zotero.Prefs.set('extensions.my-pdf-ai-bookmarks.polish', e.target.checked, true);
        });
    }
};