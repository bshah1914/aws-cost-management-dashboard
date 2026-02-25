from fastapi import APIRouter, Query
from typing import Optional
from app.services.aws_news import fetch_aws_news, get_news_categories

router = APIRouter(prefix="/api/news", tags=["AWS News"])


@router.get("/")
async def news(
    category: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
):
    items = await fetch_aws_news(category, limit)
    return {"items": items, "total": len(items)}


@router.get("/categories")
def categories():
    return {"categories": get_news_categories()}
