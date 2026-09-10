"""IGDB website-category -> string + URL-type detection + FA icon mapping.

Bodies moved verbatim from ``oneirodex/utils/functions.py`` in wave A2.3.
"""

__all__ = [
    "website_category_to_string",
    "_detect_url_type_from_pattern",
    "get_url_icon",
]


def website_category_to_string(category_id, url=None):
    """
    Convert IGDB website category ID to a readable string.
    
    Args:
        category_id (int): IGDB website category ID
        url (str, optional): URL to use for fallback pattern matching
        
    Returns:
        str: Human-readable website category string
    """
    # Mapping based on IGDB API documentation for website categories
    category_mapping = {
        1: "official",
        2: "wikia", 
        3: "wikipedia",
        4: "facebook",
        5: "twitter",
        6: "twitch",
        7: "website",  # Added missing category ID 7
        8: "instagram",
        9: "youtube",
        10: "iphone",
        11: "ipad", 
        12: "android",
        13: "steam",
        14: "reddit",
        15: "itch",
        16: "epicgames",
        17: "gog"
    }
    
    # Return mapped category if found
    if category_id in category_mapping:
        return category_mapping[category_id]
    
    # Fallback: Try to detect type from URL pattern matching if URL provided
    detected_type = _detect_url_type_from_pattern(url)
    if detected_type:
        return detected_type
    
    # Final fallback: return "website" instead of "unknown"
    return "website"


def _detect_url_type_from_pattern(url):
    """
    Helper function to detect URL type from domain patterns.
    
    Args:
        url (str): The URL to analyze
        
    Returns:
        str or None: Detected URL type, or None if no pattern matches
    """
    if not url:
        return None
        
    url_lower = url.lower()
    
    # URL pattern mapping for detection
    url_patterns = {
        "steam": ["steampowered.com", "store.steampowered.com"],
        "gog": ["gog.com", "www.gog.com"],
        "epicgames": ["epicgames.com", "store.epicgames.com"],
        "itch": ["itch.io"],
        "youtube": ["youtube.com", "youtu.be"],
        "twitch": ["twitch.tv"],
        "reddit": ["reddit.com"],
        "facebook": ["facebook.com", "fb.com"],
        "twitter": ["twitter.com", "x.com"],
        "instagram": ["instagram.com"],
        "wikipedia": ["wikipedia.org"],
        "wikia": ["fandom.com", "wikia.com"]
    }
    
    # Check URL patterns for known types
    for pattern_type, domains in url_patterns.items():
        for domain in domains:
            if domain in url_lower:
                return pattern_type
    
    return None


def get_url_icon(url_type, url):
    """
    Get the appropriate Font Awesome icon for a URL based on type and URL pattern matching.
    
    Args:
        url_type (str): The stored URL type from database
        url (str): The actual URL for pattern matching fallback
    
    Returns:
        str: Font Awesome icon class
    """
    # Primary icon mapping based on stored type
    type_icons = {
        "official": "fa-solid fa-globe",
        "website": "fa-solid fa-link",
        "wikia": "fa-brands fa-wikimedia", 
        "wikipedia": "fa-brands fa-wikipedia-w",
        "facebook": "fa-brands fa-facebook",
        "twitter": "fa-brands fa-twitter", 
        "twitch": "fa-brands fa-twitch",
        "instagram": "fa-brands fa-instagram",
        "youtube": "fa-brands fa-youtube",
        "steam": "fa-brands fa-steam",
        "reddit": "fa-brands fa-reddit",
        "itch": "fa-brands fa-itch-io",
        "epicgames": "fa-brands fa-epic-games",
        "gog": "fa-brands fa-gog",
        "android": "fa-brands fa-android",
        "iphone": "fa-brands fa-apple",
        "ipad": "fa-brands fa-apple"
    }
    
    # If we have a known type, use it
    if url_type in type_icons:
        return type_icons[url_type]
    
    # Fallback: Pattern matching for "unknown" or unmapped types
    if not url:
        return "fa-solid fa-link"
        
    # Use helper function to detect URL type from pattern
    detected_type = _detect_url_type_from_pattern(url)
    if detected_type and detected_type in type_icons:
        return type_icons[detected_type]
    
    # Default fallback
    return "fa-solid fa-link"
