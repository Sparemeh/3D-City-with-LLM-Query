import re
import json
import requests


FEET_TO_METERS = 0.3048

HF_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2'

PROMPT_TEMPLATE = """<s>[INST] Extract the filter from this query and return ONLY a valid JSON object with no extra text.

The JSON must have exactly these keys:
- "attribute": one of "height", "zoning", "assessed_value", "building_type"
- "operator": one of ">", "<", ">=", "<=", "==", "contains"
- "value": a number (for height/assessed_value) or a string (for zoning/building_type)

Query: "{query}"

Examples:
- "buildings over 50 meters" → {{"attribute": "height", "operator": ">", "value": 50}}
- "commercial buildings" → {{"attribute": "building_type", "operator": "contains", "value": "commercial"}}
- "zoning RC-G" → {{"attribute": "zoning", "operator": "==", "value": "RC-G"}}
- "less than 500000 in value" → {{"attribute": "assessed_value", "operator": "<", "value": 500000}}

Return only the JSON object. [/INST]"""


def _call_hf_api(query_text, api_key):
    """Call HuggingFace Inference API and parse the result."""
    prompt = PROMPT_TEMPLATE.format(query=query_text)
    headers = {'Authorization': f'Bearer {api_key}'}
    payload = {
        'inputs': prompt,
        'parameters': {
            'max_new_tokens': 100,
            'temperature': 0.1,
            'return_full_text': False
        }
    }
    response = requests.post(HF_API_URL, headers=headers, json=payload, timeout=30)
    response.raise_for_status()
    result = response.json()

    if isinstance(result, list) and result:
        text = result[0].get('generated_text', '')
    else:
        text = str(result)

    # Extract the first JSON object from the response
    match = re.search(r'\{[^{}]+\}', text)
    if match:
        return json.loads(match.group())
    return None


def _rule_based_parse(query_text):
    """Rule-based fallback parser for common query patterns."""
    q = query_text.lower().strip()

    # Height patterns
    height_match = re.search(
        r'(over|above|more than|greater than|taller than|at least)\s+(\d+(?:\.\d+)?)\s*(feet|ft|meters?|m)\b',
        q
    )
    if height_match:
        val = float(height_match.group(2))
        unit = height_match.group(3)
        if unit in ('feet', 'ft'):
            val *= FEET_TO_METERS
        return {'attribute': 'height', 'operator': '>', 'value': round(val, 2)}

    height_match = re.search(
        r'(under|below|less than|shorter than|at most)\s+(\d+(?:\.\d+)?)\s*(feet|ft|meters?|m)\b',
        q
    )
    if height_match:
        val = float(height_match.group(2))
        unit = height_match.group(3)
        if unit in ('feet', 'ft'):
            val *= FEET_TO_METERS
        return {'attribute': 'height', 'operator': '<', 'value': round(val, 2)}

    height_match = re.search(r'(\d+(?:\.\d+)?)\s*(feet|ft|meters?|m)\s*(or\s*)?(taller|higher|above|over)', q)
    if height_match:
        val = float(height_match.group(1))
        unit = height_match.group(2)
        if unit in ('feet', 'ft'):
            val *= FEET_TO_METERS
        return {'attribute': 'height', 'operator': '>=', 'value': round(val, 2)}

    # Assessed value patterns
    value_match = re.search(
        r'(over|above|more than|greater than)\s+\$?\s*(\d[\d,]*(?:\.\d+)?)',
        q
    )
    if value_match and ('value' in q or 'worth' in q or 'assessment' in q or '$' in query_text):
        val = float(value_match.group(2).replace(',', ''))
        return {'attribute': 'assessed_value', 'operator': '>', 'value': val}

    value_match = re.search(
        r'(under|below|less than)\s+\$?\s*(\d[\d,]*(?:\.\d+)?)',
        q
    )
    if value_match and ('value' in q or 'worth' in q or 'assessment' in q or '$' in query_text):
        val = float(value_match.group(2).replace(',', ''))
        return {'attribute': 'assessed_value', 'operator': '<', 'value': val}

    # Zoning patterns
    zoning_match = re.search(r'zoning\s+([a-z0-9\-]+)', q)
    if zoning_match:
        return {'attribute': 'zoning', 'operator': '==', 'value': zoning_match.group(1).upper()}

    zoning_match = re.search(r'(rc-g|cc-x|ib|cc-mh|dc|m-x1)', q)
    if zoning_match:
        return {'attribute': 'zoning', 'operator': '==', 'value': zoning_match.group(1).upper()}

    # Building type patterns
    type_keywords = {
        'commercial': 'commercial',
        'retail': 'retail',
        'office': 'office',
        'residential': 'residential',
        'apartments': 'apartments',
        'industrial': 'industrial',
        'hotel': 'hotel',
        'parking': 'parking',
        'warehouse': 'warehouse',
    }
    for keyword, value in type_keywords.items():
        if keyword in q:
            return {'attribute': 'building_type', 'operator': 'contains', 'value': value}

    return None


def parse_query(query_text, hf_api_key=None):
    """
    Parse a natural language query into a filter spec dict.
    Returns: {'attribute': str, 'operator': str, 'value': str|float} or None
    """
    if hf_api_key:
        try:
            result = _call_hf_api(query_text, hf_api_key)
            if result and 'attribute' in result and 'operator' in result and 'value' in result:
                return result
        except Exception:
            pass  # Fall through to rule-based

    return _rule_based_parse(query_text)
