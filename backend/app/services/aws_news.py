import feedparser
import httpx
from typing import List, Dict, Any
from cachetools import TTLCache
from datetime import datetime

_news_cache = TTLCache(maxsize=10, ttl=900)  # 15 min cache

AWS_FEEDS = [
    {
        "url": "https://aws.amazon.com/blogs/aws/feed/",
        "category": "AWS Blog",
    },
    {
        "url": "https://aws.amazon.com/about-aws/whats-new/recent/feed/",
        "category": "What's New",
    },
    {
        "url": "https://aws.amazon.com/blogs/compute/feed/",
        "category": "Compute",
    },
    {
        "url": "https://aws.amazon.com/blogs/cost-management/feed/",
        "category": "Cost Management",
    },
]


async def fetch_aws_news(category: str = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Fetch latest AWS news from RSS feeds."""
    cache_key = f"news:{category}:{limit}"
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    all_items = []
    feeds_to_fetch = AWS_FEEDS
    if category:
        feeds_to_fetch = [f for f in AWS_FEEDS if f["category"].lower() == category.lower()]

    async with httpx.AsyncClient(timeout=15.0) as client:
        for feed_info in feeds_to_fetch:
            try:
                resp = await client.get(feed_info["url"])
                if resp.status_code == 200:
                    parsed = feedparser.parse(resp.text)
                    for entry in parsed.entries[:25]:
                        published = ""
                        if hasattr(entry, "published"):
                            published = entry.published
                        elif hasattr(entry, "updated"):
                            published = entry.updated

                        summary = ""
                        if hasattr(entry, "summary"):
                            summary = entry.summary[:300]

                        all_items.append({
                            "title": entry.get("title", ""),
                            "link": entry.get("link", ""),
                            "published": published,
                            "summary": summary,
                            "category": feed_info["category"],
                        })
            except Exception:
                continue

    # Sort by published date (newest first)
    all_items.sort(key=lambda x: x.get("published", ""), reverse=True)
    result = all_items[:limit]
    _news_cache[cache_key] = result
    return result


def get_news_categories() -> List[str]:
    return [f["category"] for f in AWS_FEEDS]
