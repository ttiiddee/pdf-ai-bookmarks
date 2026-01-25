import fitz  # PyMuPDF
import os
import shutil
import tempfile

def extract_toc(pdf_path: str) -> list:
    """
    Extracts existing TOC from a PDF.
    Returns a list of [level, title, page].
    """
    try:
        doc = fitz.open(pdf_path)
        toc = doc.get_toc()
        doc.close()
        return toc
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return []

def save_toc(input_path: str, output_path: str, toc_data: list):
    """
    Writes the TOC to the PDF and saves to output_path.
    Expects toc_data to be a list of dicts: {'level': int, 'title': str, 'page_number': int}
    
    If input_path == output_path, uses a temp file to ensure safe overwrite while preserving all content.
    """
    try:
        # Convert list of dicts to PyMuPDF format [lvl, title, page]
        final_toc = []
        for item in toc_data:
            lvl = int(item.get('level', 1))
            title = str(item.get('title', 'Untitled'))
            page = int(item.get('page_number', 1))
            final_toc.append([lvl, title, page])
        
        # Determine if we're overwriting
        overwrite = os.path.abspath(input_path) == os.path.abspath(output_path)
        
        if overwrite:
            # For in-place modification, use temporary file approach
            # This preserves all annotations and content
            temp_fd, temp_path = tempfile.mkstemp(suffix='.pdf')
            os.close(temp_fd)
            
            try:
                # Open and modify
                doc = fitz.open(input_path)
                doc.set_toc(final_toc)
                
                # Save to temp file with all content preserved
                # deflate=True compresses, garbage=3 removes unused objects
                doc.save(temp_path, garbage=3, deflate=True)
                doc.close()
                
                # Replace original with temp
                shutil.move(temp_path, input_path)
                print(f"Successfully updated PDF: {input_path}")
                
            except Exception as e:
                # Clean up temp file on error
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                raise e
        else:
            # Different input/output, normal save
            doc = fitz.open(input_path)
            doc.set_toc(final_toc)
            doc.save(output_path, garbage=3, deflate=True)
            doc.close()
            print(f"Successfully saved PDF to {output_path}")
            
    except Exception as e:
        print(f"Error saving PDF: {e}")
        raise
