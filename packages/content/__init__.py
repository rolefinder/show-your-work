"""Content package: YAML load + emit into a generated TypeScript module.

Maps to the **content** boundary in docs/architecture/PACKAGE_BOUNDARIES.md.
CLI entry remains scripts/emit-content.py (thin wrapper).
"""

from .emit_site import emit_generated_module, load_corpus

__all__ = ["emit_generated_module", "load_corpus"]
