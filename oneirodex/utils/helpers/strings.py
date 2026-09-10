"""String / WTForms field helpers.

Bodies moved verbatim from ``oneirodex/utils/functions.py`` in wave A2.3.
"""
import re
import html
from wtforms.validators import ValidationError

__all__ = ["sanitize_string_input", "comma_separated_urls"]


def sanitize_string_input(input_str, max_length, allow_html=False):
    """Sanitize string input to prevent XSS and ensure length limits."""
    if not input_str:
        return ''
    
    # Convert to string and strip whitespace
    sanitized = str(input_str).strip()
    
    # HTML escape if not allowing HTML
    if not allow_html:
        sanitized = html.escape(sanitized)
    
    # Enforce length limit
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
    
    return sanitized


def comma_separated_urls(form, field):
    """Validate comma-separated YouTube embed URLs."""
    urls = field.data.split(',')
    url_pattern = re.compile(
        r'^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+$'
    )
    for url in urls:
        if not url_pattern.match(url.strip()):
            raise ValidationError('One or more URLs are invalid. Please provide valid YouTube embed URLs.')
