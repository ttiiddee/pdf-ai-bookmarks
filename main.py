import typer
from dotenv import load_dotenv
import os
import ai_engine
import pdf_handler

load_dotenv()

app = typer.Typer()

@app.command()
def main(
    input_pdf: str = typer.Argument(..., help="Path to the input PDF file"),
    polish: bool = typer.Option(True, help="Whether to try polishing existing bookmarks")
):
    """
    Generate and embed AI-powered bookmarks into a PDF.
    The PDF will be modified in place (overwritten).
    """
    typer.echo(f"Processing '{input_pdf}'...")
    
    if not os.getenv("GEMINI_API_KEY"):
        typer.echo("Error: GEMINI_API_KEY not found in .env file.", err=True)
        raise typer.Exit(code=1)

    if not os.path.exists(input_pdf):
        typer.echo(f"Error: Input file '{input_pdf}' does not exist.", err=True)
        raise typer.Exit(code=1)

    # Step 1: Extract existing bookmarks (if polish logic is enabled)
    current_toc = []
    if polish:
        typer.echo("Checking for existing bookmarks...")
        current_toc = pdf_handler.extract_toc(input_pdf)
        if current_toc:
            typer.echo(f"Found {len(current_toc)} existing bookmarks. Sending to AI for polishing.")
        else:
            typer.echo("No existing bookmarks found. Starting from scratch.")

    # Step 2: Generate new bookmarks
    typer.echo("Contacting Gemini API...")
    try:
        new_bookmarks = ai_engine.generate_outline(input_pdf, current_toc)
    except Exception as e:
        typer.echo(f"Error during AI generation: {e}", err=True)
        raise typer.Exit(code=1)

    if not new_bookmarks:
        typer.echo("AI failed to generate bookmarks or returned empty list. Aborting save.", err=True)
        raise typer.Exit(code=1)

    typer.echo(f"Generated {len(new_bookmarks)} bookmarks.")

    # Step 3: Save bookmarks to the same PDF (overwrite)
    typer.echo(f"Updating '{input_pdf}' with bookmarks...")
    pdf_handler.save_toc(input_pdf, input_pdf, new_bookmarks)
    
    typer.echo("Done!")

if __name__ == "__main__":
    app()
