"""
LLM provider abstraction for Bouldy.
Returns the correct LlamaIndex LLM based on chatbot config.
"""
from llama_index.core.llms import LLM
from llama_index.llms.openai import OpenAI
from llama_index.llms.anthropic import Anthropic
from llama_index.llms.google_genai import GoogleGenAI

def get_llm(provider: str, model: str, api_key: str | None = None) -> LLM:
    """
    Returns a LlamaIndex LLM instance based on provider config.
    
    Supported providers:
        - openai: GPT models via OpenAI API
        - anthropic: Claude models via Anthropic API
        - gemini: Google Gemini models via OpenAI-compatible endpoint
        - grok: xAI Grok models via OpenAI-compatible endpoint
        - ollama: Local models via Ollama (no API key needed)
    """
    if not provider or not model:
        raise ValueError("LLM provider and model must be configured")

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
        # xAI uses OpenAI-compatible API
        return OpenAI(
            model=model,
            api_key=api_key,
            api_base="https://api.x.ai/v1",
        )

    elif provider == "ollama":
        # Ollama runs locally, no API key needed
        from llama_index.llms.ollama import Ollama
        return Ollama(model=model, base_url="http://host.docker.internal:11434")

    else:
        raise ValueError(f"Unsupported provider: {provider}")