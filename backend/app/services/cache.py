# Redis-based semantic query cache for Bouldy
# Caches chat responses to avoid redundant LLM calls
import json
import hashlib
import logging
import numpy as np

import redis
from app.config import settings
from app.services.indexing import get_embed_model

logger = logging.getLogger(__name__)

CACHE_TTL = 3600  # 1 hour
SIMILARITY_THRESHOLD = 0.95  # cosine similarity threshold for cache hits


# Redis client
def get_redis_client() -> redis.Redis:
    return redis.from_url(settings.redis_url, decode_responses=True)


# Generate embedding for a query
def get_query_embedding(query: str) -> list[float]:
    embed_model = get_embed_model()
    return embed_model.get_query_embedding(query)


# Cosine similarity between two vectors
def cosine_similarity(a: list[float], b: list[float]) -> float:
    a_arr = np.array(a)
    b_arr = np.array(b)
    return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))


# Cache key prefix per chatbot
def cache_prefix(chatbot_id: str) -> str:
    return f"cache:{chatbot_id}"


# Try to find a cached response for a similar query
def get_cached_response(chatbot_id: str, query: str) -> dict | None:
    try:
        r = get_redis_client()
        prefix = cache_prefix(chatbot_id)
        query_embedding = get_query_embedding(query)

        # Get all cache keys for this chatbot
        keys = r.keys(f"{prefix}:*")

        for key in keys:
            cached = r.get(key)
            if not cached:
                continue

            data = json.loads(cached)
            cached_embedding = data.get("embedding")
            if not cached_embedding:
                continue

            # Check similarity
            similarity = cosine_similarity(query_embedding, cached_embedding)
            if similarity >= SIMILARITY_THRESHOLD:
                logger.info(f"Cache hit for chatbot {chatbot_id} (similarity: {similarity:.3f})")
                return {
                    "response": data["response"],
                    "sources": data["sources"],
                }

        logger.info(f"Cache miss for chatbot {chatbot_id}")
        return None

    except Exception as e:
        logger.warning(f"Cache lookup failed: {e}")
        return None


# Store a response in cache
def cache_response(chatbot_id: str, query: str, response: str, sources: list) -> None:
    try:
        r = get_redis_client()
        prefix = cache_prefix(chatbot_id)
        query_embedding = get_query_embedding(query)

        # Use hash of query as key
        query_hash = hashlib.md5(query.encode()).hexdigest()[:12]
        key = f"{prefix}:{query_hash}"

        data = {
            "query": query,
            "embedding": query_embedding,
            "response": response,
            "sources": sources,
        }

        r.setex(key, CACHE_TTL, json.dumps(data))
        logger.info(f"Cached response for chatbot {chatbot_id} (key: {query_hash})")

    except Exception as e:
        logger.warning(f"Cache store failed: {e}")


# Clear cache for a chatbot (called when documents change)
def clear_chatbot_cache(chatbot_id: str) -> None:
    try:
        r = get_redis_client()
        prefix = cache_prefix(chatbot_id)
        keys = r.keys(f"{prefix}:*")
        if keys:
            r.delete(*keys)
            logger.info(f"Cleared {len(keys)} cache entries for chatbot {chatbot_id}")
    except Exception as e:
        logger.warning(f"Cache clear failed: {e}")