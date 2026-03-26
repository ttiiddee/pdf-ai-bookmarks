var PDFAIBookmarks;

function log(msg) {
    Zotero.debug("My PDF AI Bookmarks: " + msg);
}

function install() {
    log("Installed");
}

async function startup({ id, version, rootURI }) {
    log("Starting " + version);

    // Register preferences pane
    Zotero.PreferencePanes.register({
        pluginID: 'my-pdf-ai-bookmarks@custom.com',
        src: rootURI + 'preferences.xhtml',
        scripts: [rootURI + 'preferences.js']
    });

    // Load pdf-lib library
    Services.scriptloader.loadSubScript(rootURI + 'lib/pdf-lib.js');

    // Load main plugin logic
    Services.scriptloader.loadSubScript(rootURI + 'my-pdf-ai-bookmarks.js');
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
