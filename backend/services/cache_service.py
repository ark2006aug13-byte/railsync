"""
services/cache_service.py
Async Redis caching service with automatic in-memory TTL fallback.
Ensures zero-downtime and high availability even when Redis server is unreachable.
"""
import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as aioredis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    aioredis = None


class AsyncTrainCache:
    """
    High-performance async cache manager.
    Attempts to read/write from Redis. If Redis is unavailable or fails,
    seamlessly falls back to an in-memory TTL dictionary.
    """

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self._redis_client: Optional[Any] = None
        self._redis_available: Optional[bool] = None
        self._memory_cache: Dict[str, Tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    async def _get_redis(self):
        if not HAS_REDIS:
            return None
        if self._redis_client is None:
            try:
                self._redis_client = aioredis.from_url(
                    self.redis_url,
                    decode_responses=True,
                    socket_connect_timeout=1.5,
                    socket_timeout=1.5,
                )
            except Exception as e:
                logger.warning(f"[CacheService] Could not initialize Redis client: {e}. Using in-memory fallback.")
                self._redis_available = False
                return None
        return self._redis_client

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves cached dictionary. Checks Redis first, falls back to memory.
        """
        # 1. Try Redis
        client = await self._get_redis()
        if client and self._redis_available is not False:
            try:
                val = await client.get(key)
                if val:
                    self._redis_available = True
                    return json.loads(val)
                return None
            except Exception as e:
                logger.debug(f"[CacheService] Redis GET failed for key '{key}': {e}. Falling back to memory.")
                self._redis_available = False

        # 2. In-memory TTL Fallback
        async with self._lock:
            now = time.time()
            if key in self._memory_cache:
                expiry, data = self._memory_cache[key]
                if now < expiry:
                    return data
                else:
                    del self._memory_cache[key]
            return None

    async def set(self, key: str, value: Dict[str, Any], ttl_seconds: int = 45) -> None:
        """
        Stores dictionary in cache with TTL.
        """
        # 1. Try Redis
        client = await self._get_redis()
        if client and self._redis_available is not False:
            try:
                await client.setex(key, ttl_seconds, json.dumps(value))
                self._redis_available = True
            except Exception as e:
                logger.debug(f"[CacheService] Redis SET failed for key '{key}': {e}. Falling back to memory.")
                self._redis_available = False

        # 2. In-memory Fallback (always updated to ensure consistency)
        async with self._lock:
            expiry = time.time() + ttl_seconds
            self._memory_cache[key] = (expiry, value)

    async def close(self) -> None:
        """Closes Redis connections on shutdown."""
        if self._redis_client:
            try:
                await self._redis_client.aclose()
            except Exception:
                pass


# Global singleton instance
async_cache = AsyncTrainCache()
