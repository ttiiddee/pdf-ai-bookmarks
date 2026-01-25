import google.generativeai as genai
import os
import json
import time
import typing_extensions

# Define the schema for structured output
class BookmarkItem(typing_extensions.TypedDict):
    title: str
    page_number: int
    level: int  # 1 for top level, 2 for sub-chapter, etc.

def setup_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in environment variables.")
    genai.configure(api_key=api_key)

def upload_and_wait(pdf_path: str):
    """
    Uploads the file and waits for it to be ready.
    """
    print(f"Uploading {pdf_path} to Gemini...")
    sample_file = genai.upload_file(path=pdf_path, display_name=os.path.basename(pdf_path))
    
    print(f"Uploaded file '{sample_file.display_name}' as: {sample_file.uri}")
    
    # Wait for the file to be active
    file_obj = genai.get_file(sample_file.name)
    while file_obj.state.name == "PROCESSING":
        print(".", end="", flush=True)
        time.sleep(2)
        file_obj = genai.get_file(sample_file.name)
    
    if file_obj.state.name != "ACTIVE":
        raise Exception(f"File upload failed with state: {file_obj.state.name}")
    
    print("\nFile is ready for processing.")
    return file_obj

def generate_outline(pdf_path: str, current_toc: list = None) -> list[BookmarkItem]:
    """
    Uploads PDF to Gemini and requests a JSON outline.
    """
    setup_gemini()
    file_obj = upload_and_wait(pdf_path)
    
    model = genai.GenerativeModel("gemini-3-flash-preview")
    
    prompt = """
    You are an expert PDF editor. Your task is to generate a comprehensive Table of Contents (bookmarks/outline) for the provided PDF file.
    
    Rules:
    1.  Read the entire document to understand its structure.
    2.  Generate a list of bookmarks with accurate page numbers.
    3.  'page_number' must be the PHYSICAL page number in the PDF (starting from 1), not necessarily the number printed on the page.
    4.  'level' indicates the hierarchy: 1 for chapters, 2 for sections, 3 for subsections.
    5.  Output MUST be a valid JSON list.
    """
    
    if current_toc:
        prompt += f"\n\nThe PDF already contains the following bookmarks (format: [level, title, page]). Use them as a base to refine and correct, but ensure the new list is precise and possibly more detailed if the original is lacking:\n{str(current_toc)}"
    else:
        prompt += "\n\nNo existing bookmarks were found. Please generate them from scratch based on the document content."

    print("Generating outline with Gemini...")
    response = model.generate_content(
        [prompt, file_obj],
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=list[BookmarkItem]
        )
    )
    
    try:
        # The response text should be a JSON array directly due to response_schema
        bookmarks = json.loads(response.text)
        return bookmarks
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        print(f"Raw response: {response.text}")
        return []

