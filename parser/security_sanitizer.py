import re
from typing import Any

# Key names that must be redacted regardless of value
_SECRET_KEYS = re.compile(r"(password|passwd|secret|token|authorization|x-api-key|bearer)", re.I)
# Strings that look like JWTs
_JWT = re.compile(r"^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$")
# Long hex/base64-ish strings (likely secrets)
_LONG_HEX_B64 = re.compile(r"([A-Fa-f0-9]{20,}|[A-Za-z0-9+/]{24,}={0,2})")

def _mask(v: str) -> str:
    """Mask suspicious token-like strings."""
    if _JWT.match(v) or _LONG_HEX_B64.search(v):
        return "[REDACTED]"
    return v

def sanitize_dict(d: Any) -> Any:
    """Recursively redact secrets in dict/list/str values."""
    if isinstance(d, dict):
        out = {}
        for k, v in d.items():
            if _SECRET_KEYS.search(str(k)):
                out[k] = "[REDACTED]"
            else:
                out[k] = sanitize_dict(v)
        return out
    if isinstance(d, list):
        return [sanitize_dict(x) for x in d]
    if isinstance(d, str):
        return _mask(d)
    return d