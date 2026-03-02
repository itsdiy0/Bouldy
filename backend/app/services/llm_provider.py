# LLM provider abstraction for Bouldy
# Returns the correct LlamaIndex LLM based on chatbot config
import logging

from llama_index.core.llms import LLM
from llama_index.llms.openai import OpenAI
from llama_index.llms.anthropic import Anthropic
from llama_index.llms.google_genai import GoogleGenAI

logger = logging.getLogger(__name__)


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
        logger.info("Connecting to Ollama at host.docker.internal:11434")
        return Ollama(model=model, base_url="http://host.docker.internal:11434")

    else:
        logger.error(f"Unsupported provider: {provider}")
        raise ValueError(f"Unsupported provider: {provider}")