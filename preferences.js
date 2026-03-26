window.PDFAIBookmarks_Preferences = {
    init: function () {
        // 使用 try-catch 包裹所有代码：这是最关键的一步！
        // 这样即使我们的代码出现任何未预料的错误，也会被内部消化，绝不会波及到 Zotero 的其他设置项！
        try {
            const modelSelect = document.getElementById("pdf-ai-bookmarks-model");
            const customModelRow = document.getElementById("custom-model-row");

            // 1. 安全退出机制：
            // 如果用户点开的是 Zotero 的"常规"或"同步"等其他页面，这两个元素是不存在的。
            // 此时必须立刻 return 退出，避免报错影响其他设置面板。
            if (!modelSelect || !customModelRow) {
                return;
            }

            // 2. 初始 UI 状态判定：
            // 不要去读 modelSelect.value (因为此时底层的选项可能还没加载完)
            // 直接从底层数据库读真实数据来判定【自定义行】是该藏还是该露
            const initialModel = Zotero.Prefs.get('extensions.my-pdf-ai-bookmarks.model', true);
            customModelRow.hidden = (initialModel !== 'custom');

            // 3. 事件监听器：仅负责控制视图隐藏/显示，绝对不修改 value
            // menulist 使用 command 事件，不是 change 事件
            const toggleCustomRow = (e) => {
                const selectedValue = e.target.value;
                customModelRow.hidden = (selectedValue !== 'custom');
            };

            // 4. 清理旧监听，防止多次打开面板重复绑定导致卡顿
            modelSelect.removeEventListener("command", toggleCustomRow);

            // 5. 绑定新监听 (menulist 使用 command 事件)
            modelSelect.addEventListener("command", toggleCustomRow);

            Zotero.debug("My PDF AI Bookmarks: 设置面板 UI 联动加载完毕");

        } catch (error) {
            // 拦截任何导致崩溃的错误并打印，强行终止异常传播，保全整个 Zotero 设置环境
            Zotero.debug("My PDF AI Bookmarks Error 发挥了隔离作用: " + error);
        }
    }
};