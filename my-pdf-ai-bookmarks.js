// My PDF AI Bookmarks - Personal Zotero Plugin

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


    getApiKey() {
        return Zotero.Prefs.get('extensions.my-pdf-ai-bookmarks.apiKey', true);
    },

    getBaseUrl() {
        const baseUrl = Zotero.Prefs.get('extensions.my-pdf-ai-bookmarks.baseUrl', true);
        // Default to Google Gemini if not set
        return baseUrl && baseUrl.trim() ? baseUrl.trim() : 'https://generativelanguage.googleapis.com';
    },

    getModel() {
        const model = Zotero.Prefs.get('extensions.my-pdf-ai-bookmarks.model', true);
        if (model === 'custom') {
            const customModel = Zotero.Prefs.get('extensions.my-pdf-ai-bookmarks.customModel', true);
            return customModel && customModel.trim() ? customModel.trim() : 'gemini-3-flash-preview';
        }
        return model || 'gemini-3-flash-preview';
    },

    shouldPolish() {
        return Zotero.Prefs.get('extensions.my-pdf-ai-bookmarks.polish', true) !== false;
    },

    normalizePath(path) {
        if (!path) return null;

        if (typeof path === 'string') {
            if (path.startsWith('file://')) {
                try {
                    return Services.io.newURI(path)
                        .QueryInterface(Components.interfaces.nsIFileURL)
                        .file.path;
                } catch (e) {
                    this.log("Failed to normalize file URL: " + e);
                }
            }
            return path;
        }

        if (path.path) {
            return path.path;
        }

        try {
            if (path instanceof Components.interfaces.nsIFile) {
                return path.path;
            }
        } catch (_) {
            // Ignore type check errors
        }

        return null;
    },

    normalizeBytes(data) {
        if (!data) return null;

        if (data instanceof Uint8Array) {
            return data;
        }

        if (data instanceof ArrayBuffer) {
            return new Uint8Array(data);
        }

        if (ArrayBuffer.isView(data)) {
            return new Uint8Array(data.buffer);
        }

        if (typeof data === 'string') {
            const len = data.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = data.charCodeAt(i);
            }
            return bytes;
        }

        return null;
    },

    bytesToBase64(bytes) {
        const len = bytes.byteLength;
        const CHUNK_SIZE = 8192;
        const binaryChunks = [];
        for (let i = 0; i < len; i += CHUNK_SIZE) {
            const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
            binaryChunks.push(String.fromCharCode.apply(null, chunk));
        }
        return btoa(binaryChunks.join(''));
    },

    buildPrompt(existingToc, opts = {}) {
        const shouldPolish = this.shouldPolish();
        const { totalPages, chunkStart, chunkEnd } = opts;

        let prompt = `You are an expert PDF editor. Your task is to generate a comprehensive Table of Contents (bookmarks/outline) for the provided PDF file.

Rules:
1. Read the entire document to understand its structure.
2. Generate a list of bookmarks with accurate page numbers.
3. 'page_number' must be the PHYSICAL page number in the PDF (starting from 1).
4. 'level' indicates the hierarchy: 1 for chapters, 2 for sections, 3 for subsections.
5. Output MUST be a valid JSON array matching the schema: [{"title": "Chapter 1", "page_number": 5, "level": 1}, ...]`;

        if (shouldPolish && existingToc.length > 0) {
            prompt += `\n\nThe PDF already has these bookmarks. Use them as a base to refine and improve:\n${JSON.stringify(existingToc)}`;
        } else {
            prompt += `\n\nNo existing bookmarks found. Generate from scratch.`;
        }

        if (chunkStart && chunkEnd) {
            prompt += `\n\n**IMPORTANT - CHUNK MODE:**
This PDF is CHUNK of a larger document. You are viewing pages ${chunkStart} to ${chunkEnd} (out of ${totalPages || 'unknown'} total pages).

CRITICAL RULES FOR CHUNK MODE:
1. The FIRST page you see is page ${chunkStart} of the full document, NOT page 1.
2. If you see "Page 1" printed on a page, that page is actually page ${chunkStart} in the full document.
3. To calculate the correct page_number: take the page position within this chunk (1-indexed) and add ${chunkStart - 1}.
   Example: The 5th page in this chunk = page ${chunkStart + 4} in the full document.
4. ONLY output bookmarks for content in this chunk (pages ${chunkStart}-${chunkEnd}).
5. Use the SAME JSON format as always: [{"title": "...", "page_number": X, "level": Y}, ...]`;
        }

        return prompt;
    },

    async uploadFileToGemini(bytes, mimeType, displayName, onProgress = null) {
        const apiKey = this.getApiKey();
        const size = bytes.byteLength;

        let startRes;
        try {
            startRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Upload-Protocol': 'resumable',
                    'X-Goog-Upload-Command': 'start',
                    'X-Goog-Upload-Header-Content-Length': String(size),
                    'X-Goog-Upload-Header-Content-Type': mimeType
                },
                body: JSON.stringify({
                    file: { display_name: displayName || 'pdf-ai-bookmarks.pdf' }
                })
            });
        } catch (e) {
            throw new Error(`Gemini upload start failed: ${e}`);
        }

        if (!startRes.ok) {
            const errorText = await startRes.text();
            throw new Error(`Gemini upload start error: ${startRes.status} - ${errorText}`);
        }

        const uploadUrl = startRes.headers.get('x-goog-upload-url') || startRes.headers.get('X-Goog-Upload-URL');
        if (!uploadUrl) {
            throw new Error('Gemini upload error: missing upload URL');
        }

        // Use XHR for more detailed network errors on large uploads
        const uploadRes = await new Promise((resolve, reject) => {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', uploadUrl, true);
                xhr.setRequestHeader('Content-Type', mimeType);
                xhr.setRequestHeader('X-Goog-Upload-Offset', '0');
                xhr.setRequestHeader('X-Goog-Upload-Command', 'upload, finalize');
                xhr.timeout = 10 * 60 * 1000;

                xhr.onload = () => resolve(xhr);
                xhr.onerror = () => reject(new Error(`network error (readyState=${xhr.readyState})`));
                xhr.ontimeout = () => reject(new Error(`timeout after ${xhr.timeout}ms`));
                xhr.onabort = () => reject(new Error('aborted'));

                if (xhr.upload && onProgress) {
                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const percent = Math.round((e.loaded / e.total) * 100);
                            onProgress(percent, e.loaded, e.total);
                        }
                    };
                }

                xhr.send(new Blob([bytes], { type: mimeType }));
            } catch (e) {
                reject(e);
            }
        });

        if (uploadRes.status < 200 || uploadRes.status >= 300) {
            const errorText = uploadRes.responseText || '';
            throw new Error(`Gemini upload error: ${uploadRes.status} - ${errorText}`);
        }

        let fileInfo;
        try {
            fileInfo = JSON.parse(uploadRes.responseText || '{}');
        } catch (e) {
            throw new Error(`Gemini upload error: invalid response JSON`);
        }
        const fileUri = fileInfo?.file?.uri || fileInfo?.uri;
        const fileName = fileInfo?.file?.name || fileInfo?.name;
        const fileState = fileInfo?.file?.state || fileInfo?.state;

        this.log(`File uploaded: uri=${fileUri}, name=${fileName}, state=${fileState}`);

        if (!fileUri) {
            throw new Error('Gemini upload error: missing file URI');
        }

        return { fileUri, fileName, fileState };
    },

    async waitForFileActive(fileName, maxWaitMs = 120000) {
        const apiKey = this.getApiKey();
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`);
                if (!res.ok) {
                    this.log(`File status check failed: ${res.status}`);
                    await Zotero.Promise.delay(2000);
                    continue;
                }
                const info = await res.json();
                const state = info?.state || 'UNKNOWN';
                this.log(`File state: ${state}`);

                if (state === 'ACTIVE') {
                    return info;
                } else if (state === 'FAILED') {
                    throw new Error(`File processing failed: ${JSON.stringify(info)}`);
                }

                await Zotero.Promise.delay(2000);
            } catch (e) {
                this.log(`File status check error: ${e}`);
                await Zotero.Promise.delay(2000);
            }
        }

        throw new Error(`File did not become ACTIVE within ${maxWaitMs}ms`);
    },

    async deleteGeminiFile(fileName) {
        if (!fileName) return;
        const apiKey = this.getApiKey();
        try {
            await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${fileName}?key=${apiKey}`, {
                method: 'DELETE'
            });
        } catch (_) {
            // Best-effort cleanup
        }
    },

    async runWithConcurrency(items, limit, worker) {
        const results = new Array(items.length);
        let index = 0;
        const runners = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
            while (index < items.length) {
                const current = index++;
                results[current] = await worker(items[current], current);
            }
        });
        await Promise.all(runners);
        return results;
    },

    // Robust file reading helper
    async readFile(inputPath) {
        const path = this.normalizePath(inputPath);
        this.log("readFile called for: " + path);

        if (!path) {
            throw new Error("Invalid PDF path");
        }

        // Try IOUtils first (Zotero 7/Firefox standard)
        if (typeof IOUtils !== 'undefined') {
            this.log("IOUtils is available");
            try {
                let data = await IOUtils.read(path);
                let bytes = this.normalizeBytes(data);
                this.log("IOUtils.read returned type: " + typeof data);
                if (data && data.constructor) this.log("Constructor: " + data.constructor.name);
                if (bytes && bytes.length) this.log("Length: " + bytes.length);
                if (bytes) return bytes;
            } catch (e) {
                this.log("IOUtils read failed, falling back: " + e);
            }
        } else {
            this.log("IOUtils is UNDEFINED");
        }

        // Fallback to Zotero API (returns binary string)
        this.log("Attempting Zotero.File.getBinaryContentsAsync");
        let data = await Zotero.File.getBinaryContentsAsync(path);

        this.log("Zotero.File returned type: " + typeof data);

        if (!data) {
            this.log("Zotero.File returned falsy value: " + data);
            return new Uint8Array(0);
        }

        let bytes = this.normalizeBytes(data);
        if (bytes) {
            this.log("Converted to Uint8Array, length: " + bytes.length);
            return bytes;
        }

        this.log("Data is unknown type, trying constructor");
        return new Uint8Array(data);
    },

    // Robust file writing helper
    async writeFile(path, data) {
        this.log("writeFile called, length: " + (data ? data.length : "null"));
        if (typeof IOUtils !== 'undefined') {
            try {
                return await IOUtils.write(path, data);
            } catch (e) {
                this.log("IOUtils write failed, falling back: " + e);
            }
        }

        await Zotero.File.putContentsAsync(path, data);
    },

    async generateBookmarks(pdfPath, onProgress = null) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error("API Key not configured. Please set it in Tools -> Preferences -> PDF AI Bookmarks.");
        }

        if (onProgress) onProgress(10, "Reading PDF...");
        this.log("Reading PDF file: " + pdfPath);

        // Read PDF file safely
        let pdfBytes;
        try {
            pdfBytes = await this.readFile(pdfPath);
        } catch (e) {
            this.log("readFile threw error: " + e);
            throw e;
        }

        this.log("pdfBytes type: " + typeof pdfBytes);
        if (pdfBytes) {
            this.log("pdfBytes isArray: " + Array.isArray(pdfBytes));
            this.log("pdfBytes isTypedArray: " + (pdfBytes instanceof Uint8Array));
            this.log("pdfBytes length: " + pdfBytes.length);
            if (pdfBytes.length > 5) {
                this.log("First 5 bytes: " + pdfBytes[0] + "," + pdfBytes[1] + "," + pdfBytes[2] + "," + pdfBytes[3] + "," + pdfBytes[4]);
            }
        }

        if (!pdfBytes || pdfBytes.length === 0) {
            throw new Error("Read 0 bytes from PDF file");
        }

        // Quick sanity check: PDF header should appear early in file
        const header = "%PDF-";
        let hasHeader = false;
        let headerLimit = Math.min(pdfBytes.length, 1024);
        for (let i = 0; i <= headerLimit - header.length; i++) {
            if (pdfBytes[i] === 0x25
                && pdfBytes[i + 1] === 0x50
                && pdfBytes[i + 2] === 0x44
                && pdfBytes[i + 3] === 0x46
                && pdfBytes[i + 4] === 0x2D) {
                hasHeader = true;
                break;
            }
        }
        if (!hasHeader) {
            throw new Error("Invalid PDF data: PDF header not found");
        }

        if (onProgress) onProgress(25, "Parsing PDF...");
        // Load PDF with pdf-lib
        // Using global PDFLib object
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
        const existingToc = this.extractTOC(pdfDoc);

        this.log(`Found ${existingToc.length} existing bookmarks`);

        // Convert PDF to base64 for Gemini API (standard buffer to base64)
        const len = pdfBytes.byteLength;
        // As of 2026-01-12, inline data limit increased from 20MB to 100MB
        // https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-new-file-limits/
        const MAX_INLINE_BYTES = 100 * 1024 * 1024;
        const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
        let newBookmarks = [];

        if (len <= MAX_INLINE_BYTES) {
            if (onProgress) onProgress(40, "Preparing for upload...");
            this.log("Converting to base64...");
            const base64Pdf = this.bytesToBase64(pdfBytes);

            // Call Gemini API
            if (onProgress) onProgress(60, "Uploading to Gemini...");
            this.log("Calling Gemini AI...");
            newBookmarks = await this.callGeminiAPI(base64Pdf, existingToc, {
                totalPages: pdfDoc.getPageCount()
            });
        } else {
            // Large file: Gemini models have token limits that prevent processing very large PDFs
            // Use chunked upload strategy - split PDF into smaller parts
            this.log(`Large PDF detected (${len} bytes, ~${Math.round(len/1024/1024)}MB). Using chunked upload strategy.`);
            if (onProgress) onProgress(40, "Splitting large PDF...");
            newBookmarks = await this.generateBookmarksChunked(pdfDoc, existingToc, onProgress, len, MAX_INLINE_BYTES);
        }

        this.log(`Gemini generated ${newBookmarks.length} bookmarks`);

        if (onProgress) onProgress(85, "Writing bookmarks to PDF...");
        // Apply bookmarks to PDF
        await this.applyBookmarks(pdfPath, pdfBytes, newBookmarks);

        this.log("Bookmarks applied successfully");
        if (onProgress) onProgress(100, "Done");
        return newBookmarks.length;
    },

    extractTOC(pdfDoc) {
        // Basic TOC extraction placeholder
        return [];
    },

    normalizeChunkBookmarks(bookmarks, chunkStart, chunkEnd) {
        if (!Array.isArray(bookmarks)) return [];

        const chunkPages = chunkEnd - chunkStart + 1;
        let hasAbsolute = false;
        let allRelative = true;
        for (const b of bookmarks) {
            const page = Number(b && b.page_number);
            if (!Number.isFinite(page)) continue;
            if (page >= chunkStart && page <= chunkEnd) hasAbsolute = true;
            if (page < 1 || page > chunkPages) allRelative = false;
        }
        const needsOffset = !hasAbsolute && allRelative;
        const offset = chunkStart - 1;

        return bookmarks.map((b) => {
            if (!b) return null;
            let page = Number(b.page_number);
            if (!Number.isFinite(page)) return null;
            page = Math.round(page);
            if (needsOffset) page += offset;
            if (page < chunkStart || page > chunkEnd) return null;
            let level = Number(b.level);
            if (!Number.isFinite(level)) level = 1;
            level = Math.max(1, Math.min(6, Math.round(level)));
            let title = b.title ? String(b.title) : 'Untitled';
            return { title, page_number: page, level };
        }).filter(Boolean);
    },

    async generateBookmarksChunked(pdfDoc, existingToc, onProgress, totalBytes, maxInlineBytes) {
        const totalPages = pdfDoc.getPageCount();
        
        // Base64 encoding adds ~33% overhead
        // Target 35MB raw data (= ~47MB base64) - 48MB worked before, 55MB failed
        // Using XHR now which should be more reliable than fetch
        const TARGET_CHUNK_RAW_BYTES = 35 * 1024 * 1024;
        const avgBytesPerPage = totalBytes / totalPages;
        // Cap at 500 pages per chunk
        const pagesPerChunk = Math.max(20, Math.min(500, Math.floor(TARGET_CHUNK_RAW_BYTES / avgBytesPerPage)));
        const chunkTotal = Math.ceil(totalPages / pagesPerChunk);

        this.log(`Chunked upload: ${totalBytes} bytes (${totalPages} pages), avg ${Math.round(avgBytesPerPage/1024)}KB/page, ${pagesPerChunk} pages/chunk, ${chunkTotal} chunks total.`);
        if (onProgress) onProgress(40, "Splitting PDF for upload...");

        const chunks = [];
        for (let start = 0; start < totalPages; start += pagesPerChunk) {
            const end = Math.min(start + pagesPerChunk, totalPages);
            chunks.push({ start, end });
        }

        // Reduce concurrency to 1 for stability with large requests
        const concurrency = 1;
        const results = await this.runWithConcurrency(chunks, concurrency, async (chunk, idx) => {
            const { start, end } = chunk;
            this.log(`Creating chunk ${idx+1}/${chunkTotal}: pages ${start+1}-${end}`);
            const chunkDoc = await PDFLib.PDFDocument.create();
            const pageIndexes = [];
            for (let i = start; i < end; i++) pageIndexes.push(i);
            const copiedPages = await chunkDoc.copyPages(pdfDoc, pageIndexes);
            copiedPages.forEach(page => chunkDoc.addPage(page));
            const chunkBytes = await chunkDoc.save();
            const chunkSizeMB = Math.round(chunkBytes.byteLength/1024/1024*100)/100;

            this.log(`Chunk ${idx+1} size: ${chunkSizeMB}MB (${end-start} pages), converting to base64...`);
            const base64Pdf = this.bytesToBase64(chunkBytes);
            const base64SizeMB = Math.round(base64Pdf.length/1024/1024*100)/100;
            this.log(`Chunk ${idx+1} base64 size: ${base64SizeMB}MB`);

            const progressBase = 50;
            const progressSpan = 30;
            const progress = progressBase + Math.floor((idx / chunkTotal) * progressSpan);
            if (onProgress) onProgress(progress, `Uploading chunk ${idx + 1}/${chunkTotal} (${base64SizeMB}MB)...`);

            this.log(`Sending chunk ${idx+1} to Gemini API...`);
            const chunkBookmarks = await this.callGeminiAPI(base64Pdf, existingToc, {
                totalPages,
                chunkStart: start + 1,
                chunkEnd: end,
                chunkPages: end - start
            });
            this.log(`Chunk ${idx+1} returned ${chunkBookmarks.length} bookmarks`);

            return this.normalizeChunkBookmarks(chunkBookmarks, start + 1, end);
        });

        const merged = [];
        for (const chunkList of results) {
            if (chunkList && chunkList.length) {
                merged.push(...chunkList);
            }
        }
        return merged;
    },

    getOrCreateOutlines(pdfDoc) {
        const context = pdfDoc.context;
        const catalog = pdfDoc.catalog;
        const outlinesKey = PDFLib.PDFName.of('Outlines');

        let outlinesRef = catalog.get(outlinesKey);
        let outlinesDict = catalog.lookupMaybe(outlinesKey, PDFLib.PDFDict);

        if (!outlinesDict) {
            outlinesDict = context.obj({
                Type: PDFLib.PDFName.of('Outlines'),
                Count: PDFLib.PDFNumber.of(0)
            });
            outlinesRef = context.register(outlinesDict);
            catalog.set(outlinesKey, outlinesRef);
        } else if (!(outlinesRef instanceof PDFLib.PDFRef)) {
            outlinesRef = context.register(outlinesDict);
            catalog.set(outlinesKey, outlinesRef);
        }

        return { root: outlinesDict, ref: outlinesRef };
    },

    async callGeminiAPI(base64Pdf, existingToc, opts = {}) {
        const apiKey = this.getApiKey();
        const baseUrl = this.getBaseUrl();
        const model = this.getModel();
        const prompt = this.buildPrompt(existingToc, opts);

        const requestBody = JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: "application/pdf",
                            data: base64Pdf
                        }
                    }
                ]
            }],
            generationConfig: {
                response_mime_type: "application/json",
                response_schema: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            page_number: { type: "integer" },
                            level: { type: "integer" }
                        },
                        required: ["title", "page_number", "level"]
                    }
                }
            }
        });

        // Build API URL based on configured base URL and model
        // For AIHubMix and other proxies, the path structure may differ
        const apiUrl = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
        this.log(`Calling API at: ${baseUrl} with model: ${model}`);

        // Retry logic for transient network errors
        const MAX_RETRIES = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Use XMLHttpRequest instead of fetch for better reliability with large payloads
                const result = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', apiUrl, true);
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.timeout = 5 * 60 * 1000; // 5 minute timeout

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve({ status: xhr.status, text: xhr.responseText });
                        } else {
                            reject(new Error(`API error: ${xhr.status} - ${xhr.responseText}`));
                        }
                    };
                    xhr.onerror = () => reject(new Error(`NetworkError (XHR): readyState=${xhr.readyState}, status=${xhr.status}`));
                    xhr.ontimeout = () => reject(new Error(`Timeout after ${xhr.timeout}ms`));
                    xhr.onabort = () => reject(new Error('Request aborted'));

                    xhr.send(requestBody);
                });

                const data = JSON.parse(result.text);
                const textContent = data.candidates[0].content.parts[0].text;
                return JSON.parse(textContent);

            } catch (e) {
                lastError = e;
                const isNetworkError = e.message && (e.message.includes('NetworkError') || e.message.includes('Timeout'));
                this.log(`API call attempt ${attempt}/${MAX_RETRIES} failed: ${e.message}`);

                if (attempt < MAX_RETRIES && isNetworkError) {
                    // Wait before retry: 2s, 4s, 8s
                    const waitMs = Math.pow(2, attempt) * 1000;
                    this.log(`Waiting ${waitMs}ms before retry...`);
                    await Zotero.Promise.delay(waitMs);
                } else if (!isNetworkError) {
                    // Non-network errors (like 400) should not retry
                    throw e;
                }
            }
        }

        throw lastError;
    },

    async callGeminiAPIWithFile(fileUri, existingToc, opts = {}) {
        const apiKey = this.getApiKey();
        const baseUrl = this.getBaseUrl();
        const prompt = this.buildPrompt(existingToc, opts);

        const apiUrl = `${baseUrl}/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt + "\n\nIMPORTANT: Output ONLY a valid JSON array, no markdown, no explanation." },
                        {
                            file_data: {
                                mime_type: "application/pdf",
                                file_uri: fileUri
                            }
                        }
                    ]
                }],
                generationConfig: {
                    response_mime_type: "application/json"
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const textContent = data.candidates[0].content.parts[0].text;
        return JSON.parse(textContent);
    },

    async applyBookmarks(pdfPath, pdfBytes, bookmarks) {
        // Load PDF with pdf-lib
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);

        // Get or create outline
        const { root, ref: rootRef } = this.getOrCreateOutlines(pdfDoc);

        // Build outline
        const pages = pdfDoc.getPages();
        const pageRefs = pages.map(page => page.ref);

        const parentStates = new Map();
        const getParentState = (parentRef, parentDict) => {
            const key = parentRef.toString();
            if (!parentStates.has(key)) {
                parentStates.set(key, {
                    dict: parentDict,
                    firstRef: null,
                    lastRef: null,
                    lastDict: null,
                    count: 0
                });
            }
            return parentStates.get(key);
        };

        const updateParent = (state, childRef, childDict) => {
            if (state.lastDict) {
                state.lastDict.set(PDFLib.PDFName.of('Next'), childRef);
                childDict.set(PDFLib.PDFName.of('Prev'), state.lastRef);
            }
            if (!state.firstRef) {
                state.firstRef = childRef;
            }
            state.lastRef = childRef;
            state.lastDict = childDict;
            state.count += 1;
            state.dict.set(PDFLib.PDFName.of('First'), state.firstRef);
            state.dict.set(PDFLib.PDFName.of('Last'), state.lastRef);
            state.dict.set(PDFLib.PDFName.of('Count'), PDFLib.PDFNumber.of(state.count));
        };

        const levelStack = [];
        const rootState = getParentState(rootRef, root);

        for (const bookmark of bookmarks) {
            const title = bookmark.title || 'Untitled';
            const pageNum = (bookmark.page_number || 1) - 1; // Convert to 0-indexed
            let level = Number(bookmark.level);
            if (!Number.isFinite(level)) level = 1;
            level = Math.max(1, Math.min(6, Math.round(level)));
            if (level > levelStack.length + 1) {
                level = levelStack.length + 1;
            }

            if (pageNum < 0 || pageNum >= pages.length) continue;

            // Create destination array
            // Format: [pageRef, /XYZ, left, top, zoom]
            // We use standard /XYZ with null params to keep current view settings
            const dest = pdfDoc.context.obj([
                pageRefs[pageNum],
                PDFLib.PDFName.of('XYZ'),
                null,
                null,
                null
            ]);

            // Create outline item
            let parentRef = rootRef;
            let parentDict = root;
            if (level > 1) {
                const parent = levelStack[level - 2];
                if (parent) {
                    parentRef = parent.ref;
                    parentDict = parent.dict;
                }
            }

            const outlineItem = pdfDoc.context.obj({
                Title: PDFLib.PDFHexString.fromText(title),
                Parent: parentRef,
                Dest: dest
            });

            const outlineItemRef = pdfDoc.context.register(outlineItem);

            const parentState = getParentState(parentRef, parentDict);
            updateParent(parentState, outlineItemRef, outlineItem);

            levelStack[level - 1] = {
                ref: outlineItemRef,
                dict: outlineItem
            };
            levelStack.length = level;
        }

        if (!rootState.firstRef) {
            root.set(PDFLib.PDFName.of('Count'), PDFLib.PDFNumber.of(0));
        }

        // Save modified PDF
        const modifiedBytes = await pdfDoc.save();
        this.log("Writing modified PDF to: " + pdfPath);
        await this.writeFile(pdfPath, modifiedBytes);
    },

    async runBookmarkGenerator(filePath, item = null) {
        if (!filePath && item) {
            try {
                filePath = await item.getFilePathAsync();
            } catch (e) {
                this.log("Failed to resolve file path from item: " + e);
            }
        }

        if (!filePath) {
            this.log("No file path found.");
            return;
        }

        this.log(`Starting bookmark generation for: ${filePath}`);

        let progressWin = new Zotero.ProgressWindow();
        progressWin.changeHeadline("Generating Bookmarks...");
        progressWin.show();
        let itemProgress = new progressWin.ItemProgress(
            "Processing PDF...",
            "Analyzing " + filePath.split('/').pop()
        );
        itemProgress.setProgress(5);

        try {
            const onProgress = (percent, text) => {
                if (text) itemProgress.setText(text);
                if (typeof percent === 'number') itemProgress.setProgress(percent);
            };

            const count = await this.generateBookmarks(filePath, onProgress);

            itemProgress.setProgress(100);
            itemProgress.setText(`Done! Added ${count} bookmarks.`);
            progressWin.startCloseTimer(2000);

            Zotero.getMainWindow().alert(`Success! Generated ${count} bookmarks. Please reload the PDF tab to see changes.`);
        } catch (e) {
            Zotero.logError(e);
            itemProgress.setError();
            itemProgress.setText("Error: " + e.message);
            Zotero.getMainWindow().alert("Error: " + e.message);
        }
    },

    addToWindow(window) {
        let doc = window.document;

        let toolsMenu = doc.getElementById('menu_ToolsPopup');
        if (toolsMenu) {
            if (toolsMenu.querySelector('#pdf-ai-bookmarks-menu')) return;

            this.log("Adding menu item to window: " + doc.title);

            let menuitem = doc.createXULElement('menuitem');
            menuitem.id = 'pdf-ai-bookmarks-menu';
            menuitem.setAttribute('label', 'Generate PDF AI Bookmarks');
            menuitem.addEventListener('command', async () => {
                let attachment = null;

                // Prefer active reader attachment (matches prior button behavior)
                try {
                    let win = Zotero.getMainWindow();
                    let tabID = win && win.Zotero_Tabs ? win.Zotero_Tabs.selectedID : null;
                    if (tabID && Zotero.Reader && Zotero.Reader.getByTabID) {
                        let reader = Zotero.Reader.getByTabID(tabID);
                        if (reader && reader.itemID) {
                            attachment = Zotero.Items.get(reader.itemID);
                        }
                    }
                } catch (e) {
                    this.log("Failed to detect active reader: " + e);
                }

                // Fallback: use selected item/attachment
                if (!attachment) {
                    let pane = Zotero.getActiveZoteroPane();
                    let items = pane.getSelectedItems();
                    let selectedItem = items && items.length ? items[0] : null;

                    if (selectedItem) {
                        if (selectedItem.isAttachment && selectedItem.isAttachment()
                            && selectedItem.isPDFAttachment && selectedItem.isPDFAttachment()) {
                            attachment = selectedItem;
                        } else if (selectedItem.getAttachments) {
                            let attachmentIDs = selectedItem.getAttachments();
                            let pdfAttachments = attachmentIDs
                                .map(id => Zotero.Items.get(id))
                                .filter(att => att && att.isAttachment && att.isAttachment()
                                    && att.isPDFAttachment && att.isPDFAttachment());

                            if (pdfAttachments.length) {
                                attachment = pdfAttachments[0];
                                this.log("Multiple PDFs found; using first attachment");
                            }
                        }
                    }
                }

                if (attachment) {
                    await this.runBookmarkGenerator(null, attachment);
                } else {
                    window.alert("Please select a PDF attachment or open a PDF in the reader.");
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
