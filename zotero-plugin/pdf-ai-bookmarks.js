var pythonPath = "/Users/edwintuan/Documents/Code/pdf-ai-bookmarks/venv/bin/python";
var scriptPath = "/Users/edwintuan/Documents/Code/pdf-ai-bookmarks/main.py";

PDFAIBookmarks = {
    id: null,
    version: null,
    rootURI: null,
    addedElementIDs: [],

    init({ id, version, rootURI }) {
        this.id = id;
        this.version = version;
        this.rootURI = rootURI;
    },

    log(msg) {
        Zotero.debug("PDF AI Bookmarks: " + msg);
    },

    async runBookmarkGenerator(filePath) {
        if (!filePath) {
            this.log("No file path found.");
            return;
        }

        const command = pythonPath;
        const args = [scriptPath, filePath];

        this.log(`Running: ${command} ${args.join(" ")}`);

        let progressWin = new Zotero.ProgressWindow();
        progressWin.changeHeadline("Generating Bookmarks...");
        progressWin.show();
        let itemProgress = new progressWin.ItemProgress(
            "Sending to Gemini...",
            "Processing " + filePath.split('/').pop()
        );
        itemProgress.setProgress(50);

        try {
            await Zotero.Utilities.Internal.exec(command, args);
            itemProgress.setProgress(100);
            itemProgress.setText("Done!");
            progressWin.startCloseTimer(2000);

            Zotero.getMainWindow().alert("Bookmarks generated! Please reload the PDF tab.");
        } catch (e) {
            Zotero.logError(e);
            itemProgress.setError();
            itemProgress.setText("Error: " + e);
        }
    },

    addToWindow(window) {
        let doc = window.document;

        // Add to Tools menu
        let toolsMenu = doc.getElementById('menu_ToolsPopup');
        if (toolsMenu) {
            if (toolsMenu.querySelector('#pdf-ai-bookmarks-menu')) return;

            this.log("Adding menu item to window: " + doc.title);

            let menuitem = doc.createXULElement('menuitem');
            menuitem.id = 'pdf-ai-bookmarks-menu';
            menuitem.setAttribute('label', 'Generate PDF AI Bookmarks');
            menuitem.addEventListener('command', async () => {
                let pane = Zotero.getActiveZoteroPane();
                let items = pane.getSelectedItems();
                let item = items[0];
                if (item && item.isAttachment()) {
                    let path = await item.getFilePath();
                    this.runBookmarkGenerator(path);
                } else {
                    window.alert("Please select a PDF attachment.");
                }
            });
            toolsMenu.appendChild(menuitem);

            this.addedElementIDs.push('pdf-ai-bookmarks-menu');
        }
    },

    removeFromWindow(window) {
        let doc = window.document;
        for (let id of this.addedElementIDs) {
            let elem = doc.getElementById(id);
            if (elem) elem.remove();
        }
    },

    addToAllWindows() {
        var windows = Zotero.getMainWindows();
        for (let win of windows) {
            this.addToWindow(win);
        }
    },

    removeFromAllWindows() {
        var windows = Zotero.getMainWindows();
        for (let win of windows) {
            this.removeFromWindow(win);
        }
    }
};
