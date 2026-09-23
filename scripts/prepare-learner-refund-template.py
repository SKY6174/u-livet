"""Prepare the supplied refund form without re-typesetting its artwork.

Usage: python3 scripts/prepare-learner-refund-template.py /path/to/refund.pdf
Requires PyMuPDF. The prefilled footer year is removed so the selected
application date can be drawn there; all vectors, fonts, and margins remain.
"""
from pathlib import Path
import sys
import pymupdf

source = pymupdf.open(sys.argv[1])
assert len(source) == 1
assert tuple(source[0].rect) == (0, 0, 595, 842)

result = pymupdf.open()
result.insert_pdf(source, from_page=0, to_page=0)
page = result[0]
year = page.search_for("2026년")
assert len(year) == 1
date_area = pymupdf.Rect(220, 456, 370, 481)
assert date_area.contains(year[0])
page.add_redact_annot(date_area, fill=False, cross_out=False)
page.apply_redactions(images=0, graphics=0)
result.set_metadata({"title": "U-LIFE learner refund template"})

output = Path(__file__).resolve().parents[1] / "public/forms/learner-refund.pdf"
result.save(output, garbage=4, deflate=True)
print("Prepared refund: 595 x 842 pt, original vectors/fonts preserved")
