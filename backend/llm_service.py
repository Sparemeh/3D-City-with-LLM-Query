import re
import json
import logging
import requests

logger = logging.getLogger(__name__)


HF_API_URL = 'https://router.huggingface.co/v1/chat/completions'

SYSTEM_PROMPT = (
    'You are a filter extractor. Return ONLY a valid JSON object with exactly these keys: '
    '"attribute" (one of: height, zoning, assessed_value, building_type), '
    '"operator" (one of: >, <, >=, <=, ==, contains), '
    '"value" (a number for height/assessed_value, a string for zoning/building_type). '
    'No explanation, no markdown, just the JSON object.'
)

USER_PROMPT_TEMPLATE = (
    'Examples:\n'
    '"buildings over 50 meters" -> {{"attribute": "height", "operator": ">", "value": 50}}\n'
    '"commercial buildings" -> {{"attribute": "building_type", "operator": "contains", "value": "commercial"}}\n'
    '"zoning RC-G" -> {{"attribute": "zoning", "operator": "==", "value": "RC-G"}}\n'
    '"less than 500000 in value" -> {{"attribute": "assessed_value", "operator": "<", "value": 500000}}\n\n'
    'Query: "{query}"'
)


def _call_hf_api(query_text, api_key):
    """Call HuggingFace chat completions API and parse the result."""
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    payload = {
        'model': 'Qwen/Qwen2.5-7B-Instruct:fastest',
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': USER_PROMPT_TEMPLATE.format(query=query_text)}
        ],
        'max_tokens': 100,
        'temperature': 0.1
    }
    response = requests.post(HF_API_URL, headers=headers, json=payload, timeout=30)
    if not response.ok:
        logger.error('HuggingFace API error %s: %s', response.status_code, response.text)
        raise requests.exceptions.HTTPError(
            f'{response.status_code} {response.reason}: {response.text}',
            response=response
        )
    result = response.json()

    text = result['choices'][0]['message']['content']

    match = re.search(r'\{[^{}]+\}', text)
    if match:
        return json.loads(match.group())
    return None


def parse_query(query_text, hf_api_key):
    """
    Parse a natural language query into a filter spec dict using HuggingFace LLM.
    Returns: {'attribute': str, 'operator': str, 'value': str|float} or None
    Raises: RuntimeError on API errors
    """
    try:
        result = _call_hf_api(query_text, hf_api_key)
    except requests.exceptions.HTTPError as e:
        raise RuntimeError(f'HuggingFace API error: {e}') from e
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f'HuggingFace request failed: {e}') from e
    if result and 'attribute' in result and 'operator' in result and 'value' in result:
        return result
    return None
