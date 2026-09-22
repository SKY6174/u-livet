"""Split the supplied learner PDF without re-typesetting its original artwork.

Usage: python3 scripts/prepare-learner-templates.py /path/to/original.pdf
Requires PyMuPDF. Only the sample course title and date text are removed;
redactions do not touch vector artwork, backgrounds, or images.
"""
from pathlib import Path
import sys
import pymupdf

source = pymupdf.open(sys.argv[1])
assert len(source) == 2
output = Path(__file__).resolve().parents[1] / "public/forms"
output.mkdir(parents=True, exist_ok=True)
for index, kind in enumerate(("application", "scholarship")):
    result = pymupdf.open()
    result.insert_pdf(source, from_page=index, to_page=index)
    page = result[0]
    assert tuple(page.rect) == (0, 0, 595, 842)
    course = page.search_for("실버푸드전문가양성과정")
    assert len(course) == 1
    page.add_redact_annot(course[0], fill=False, cross_out=False)
    date = (239, 689, 355, 707) if index == 0 else (195, 651, 401, 670)
    page.add_redact_annot(pymupdf.Rect(date), fill=False, cross_out=False)
    page.apply_redactions(images=0, graphics=0)
    result.set_metadata({"title": f"U-LIFE learner {kind} template"})
    result.save(output / f"learner-{kind}.pdf", garbage=4, deflate=True)
    print(f"Prepared {kind}: 595 x 842 pt, original vectors/fonts preserved")
