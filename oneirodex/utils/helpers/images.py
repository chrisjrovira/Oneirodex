"""Local PIL image helpers.

Bodies moved verbatim from ``oneirodex/utils/functions.py`` in wave A2.3.
"""
from PIL import Image as PILImage

__all__ = ["square_image"]


def square_image(image, size):
    """Create a square image with the given size."""
    image.thumbnail((size, size))
    if image.size[0] != size or image.size[1] != size:
        new_image = PILImage.new('RGB', (size, size), color='black')
        offset = ((size - image.size[0]) // 2, (size - image.size[1]) // 2)
        new_image.paste(image, offset)
        image = new_image
    return image
