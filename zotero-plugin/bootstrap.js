var PDFAIBookmarks;

function log(msg) {
    Zotero.debug("PDF AI Bookmarks: " + msg);
}

function install() {
    log("Installed");
}

async function startup({ id, version, rootURI }) {
    log("Starting " + version);

    Services.scriptloader.loadSubScript(rootURI + 'pdf-ai-bookmarks.js');
    PDFAIBookmarks.init({ id, version, rootURI });
    PDFAIBookmarks.addToAllWindows();
}

function onMainWindowLoad({ window }) {
    PDFAIBookmarks.addToWindow(window);
}

function onMainWindowUnload({ window }) {
    PDFAIBookmarks.removeFromWindow(window);
}

function shutdown() {
    log("Shutting down");
    PDFAIBookmarks.removeFromAllWindows();
    PDFAIBookmarks = undefined;
}

function uninstall() {
    log("Uninstalled");
}
