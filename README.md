# My PDF AI Bookmarks for Zotero

A personal Zotero 8 plugin that automatically generates hierarchical PDF bookmarks (outlines/table of contents) using AI.

## Features

- **One-click bookmark generation** - Generate comprehensive bookmarks from the Tools menu
- **AI-powered analysis** - Uses Gemini AI to analyze PDF structure and create accurate bookmarks
- **Model selection** - Choose from multiple Gemini models or use custom model
- **Multiple API providers** - Support Google Gemini, AIHubMix, and other compatible services
- **Hierarchical structure** - Properly nested chapters, sections, and subsections
- **Large file support** - Automatically splits large PDFs into chunks for processing
- **Preserves annotations** - Only modifies bookmarks, leaving your highlights and notes intact

## Installation

1. Download the latest `my-pdf-ai-bookmarks.xpi` from your local build
2. In Zotero, go to **Tools → Add-ons**
3. Click the gear icon and select **Install Add-on From File...**
4. Select the downloaded `.xpi` file
5. Restart Zotero

## Configuration

1. Go to **Zotero → Settings → My PDF AI Bookmarks**
2. Enter your API Key
3. (Optional) Enter a custom Base URL for API proxy services
4. (Optional) Select the AI model to use
5. Click OK to save

### API Providers

**Google Gemini (Default)**
- Base URL: `https://generativelanguage.googleapis.com`
- Get your API key at: https://aistudio.google.com/app/apikey

**AIHubMix**
- Base URL: `https://aihubmix.com/gemini`
- Supports native Gemini API format through proxy
- Get your API key at: https://aihubmix.com

**Other Providers**
Any service that supports the Gemini native API format can be used by setting the appropriate Base URL.

### Available Models

- **Gemini 3 Flash Preview** (default) - Fast and efficient
- **Gemini 2.5 Flash Preview** - Balanced performance
- **Gemini 2.5 Pro Preview** - Best quality for complex documents
- **Gemini 2.0 Flash** - Stable version
- **Gemini 2.0 Flash Lite** - Lightweight option
- **Custom** - Enter any model name supported by your provider

## Usage

1. Open a PDF in Zotero's reader, or select an item with a PDF attachment
2. Go to **Tools → Generate PDF AI Bookmarks**
3. Wait for the AI to analyze the document and generate bookmarks
4. Reload the PDF tab to see the new bookmarks

## Requirements

- Zotero 8.0 or later
- Gemini API key (free tier available)

## How It Works

The plugin:
1. Reads the PDF file from your Zotero library
2. Sends it to the configured AI model for structure analysis
3. Receives a hierarchical list of bookmarks with page numbers
4. Writes the bookmarks directly into the PDF file

For large PDFs (>100MB), the plugin automatically splits the document into smaller chunks, processes them separately, and merges the results.

## Limitations

- Bookmark quality depends on the PDF's structure and readability
- Very large PDFs may take several minutes to process
- Requires an active internet connection

## License

MIT License

## Acknowledgments

- [pdf-lib](https://pdf-lib.js.org/) - PDF manipulation library
- [Google Gemini](https://ai.google.dev/) - AI model for document analysis
