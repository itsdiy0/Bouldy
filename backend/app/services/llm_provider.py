# LLM provider abstraction for Bouldy
# Returns the correct LlamaIndex LLM based on chatbot config
import logging

from llama_index.core.llms import LLM
from llama_index.llms.openai import OpenAI
from llama_index.llms.anthropic import Anthropic
from llama_index.llms.google_genai import GoogleGenAI

logger = logging.getLogger(__name__)

DEFAULT_OLLAMA_URL = "http://host.docker.internal:11434"


# Get LLM instance based on provider config
def get_llm(provider: str, model: str, api_key: str | None = None) -> LLM:
    if not provider or not model:
        raise ValueError("LLM provider and model must be configured")

    logger.info(f"Loading LLM: {provider}/{model}")

    if provider == "openai":
        if not api_key:
            raise ValueError("OpenAI requires an API key")
        return OpenAI(model=model, api_key=api_key)

    elif provider == "anthropic":
        if not api_key:
            raise ValueError("Anthropic requires an API key")
        return Anthropic(model=model, api_key=api_key)

    elif provider == "gemini":
        if not api_key:
            raise ValueError("Google Gemini requires an API key")
        return GoogleGenAI(
            model=f"models/{model}",
            api_key=api_key,
        )

    elif provider == "grok":
        if not api_key:
            raise ValueError("Grok (xAI) requires an API key")
        return OpenAI(
            model=model,
            api_key=api_key,
            api_base="https://api.x.ai/v1",
            context_window=131072,
            is_chat_model=True,
        )

    elif provider == "ollama":
        from llama_index.llms.ollama import Ollama
        base_url = api_key.strip() if api_key and api_key.strip() else DEFAULT_OLLAMA_URL
        if not base_url.startswith("http"):
            base_url = "http://" + base_url
        logger.info(f"Connecting to Ollama at {base_url}")
        return Ollama(model=model, base_url=base_url, context_window=4096, request_timeout=120)

    else:
        logger.error(f"Unsupported provider: {provider}")
        raise ValueError(f"Unsupported provider: {provider}")