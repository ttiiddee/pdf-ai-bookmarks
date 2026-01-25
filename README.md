# PDF AI Bookmarks for Zotero

A Zotero 8 plugin that automatically generates hierarchical PDF bookmarks (outlines/table of contents) using Google's Gemini AI.

## Features

- **One-click bookmark generation** - Generate comprehensive bookmarks from the Tools menu
- **AI-powered analysis** - Uses Gemini AI to analyze PDF structure and create accurate bookmarks
- **Hierarchical structure** - Properly nested chapters, sections, and subsections
- **Large file support** - Automatically splits large PDFs into chunks for processing
- **Preserves annotations** - Only modifies bookmarks, leaving your highlights and notes intact

## Installation

1. Download the latest `pdf-ai-bookmarks.xpi` from the [Releases](https://github.com/edwintuan/pdf-ai-bookmarks/releases) page
2. In Zotero, go to **Tools → Add-ons**
3. Click the gear icon and select **Install Add-on From File...**
4. Select the downloaded `.xpi` file
5. Restart Zotero

## Configuration

1. Go to **Zotero → Settings → PDF AI Bookmarks**
2. Enter your [Google Gemini API Key](https://aistudio.google.com/app/apikey)
3. Click OK to save

## Usage

1. Open a PDF in Zotero's reader, or select an item with a PDF attachment
2. Go to **Tools → Generate PDF AI Bookmarks**
3. Wait for the AI to analyze the document and generate bookmarks
4. Reload the PDF tab to see the new bookmarks

## Requirements

- Zotero 8.0 or later
- Google Gemini API key (free tier available)

## How It Works

The plugin:
1. Reads the PDF file from your Zotero library
2. Sends it to Gemini AI for structure analysis
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
