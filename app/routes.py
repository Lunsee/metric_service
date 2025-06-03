from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db.database import get_db
from fastapi import Depends, FastAPI, HTTPException, status, Request, Response, Body
from fastapi import FastAPI, Form, Request, Depends, APIRouter
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.responses import RedirectResponse
from pydantic import BaseModel
from app.models import Websites, User, Statistics
from datetime import datetime, timedelta, timezone
import logging
from typing import Dict

logger = logging.getLogger(__name__)
router = APIRouter()
class MetricCreate(BaseModel):
    url: str


@router.post("/addMetrics")
def add_metric(data: MetricCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    print(f"[addMetrics] Попытка добавить метрику для пользователя: {user.id} ({user.username})")
    print(f"[addMetrics] URL метрики: {data.url}")

    metric = Websites(url=data.url, user_id=user.id)
    db.add(metric)
    db.commit()
    db.refresh(metric)


    print(f"[addMetrics] Метрика добавлена с id={metric.id}")
    return {"id": metric.id, "url": metric.url, "public_key": metric.public_key}


@router.get("/loadMetrics")
def load_metrics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    print(f"[loadMetrics] Загрузка метрик для пользователя: {user.id} ({user.username})")

    metrics = db.query(Websites).filter(Websites.user_id == user.id).all()
    print(f"[loadMetrics] Найдено {len(metrics)} метрик")

    for m in metrics:
        print(f"[loadMetrics] Метрика: id={m.id}, url={m.url}")

    user_info = db.query(User).filter(User.id == user.id).first()
    print(f"[loadMetrics] Пользователь: id={user_info.id}, username={user_info.username}")

    return {
        "user": {"id": user_info.id, "username": user_info.username},
        "metrics": [{"id": m.id, "url": m.url, "public_key": m.public_key} for m in metrics]
    }


@router.delete("/deleteMetric/{public_key}")
def delete_metric(public_key: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    logger.info(f"User {user.id} ({user.username}) requested deletion of metric with public_key={public_key}")
    #metric = db.query(Websites).filter(Websites.id == metric_id, Websites.user_id == user.id).first()
    metric = db.query(Websites).filter(Websites.public_key == public_key, Websites.user_id == user.id).first()
    if metric is None:
        logger.warning(f"Metric with public_key={public_key} not found for user {user.id} ({user.username})")
        raise HTTPException(status_code=404, detail="Metric not found")
    try:
       # db.query(Statistics).filter(Statistics.metric_id == metric.id).delete()
        db.query(Statistics).filter(Statistics.metric_id == metric.id).delete(synchronize_session=False)

        db.delete(metric)
        db.commit()
        logger.info(f"Metric with public_key={public_key} deleted successfully for user {user.id} ({user.username})")
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting metric with public_key={public_key} for user {user.id} ({user.username}): {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

    return {"message": "Metric deleted successfully"}



@router.post("/collect")
async def collect_event(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        logger.info(f"[API] Received event: {data}")

        public_key = data.get("public_key")
        if not public_key:
            raise HTTPException(status_code=400, detail="public_key is required")

        metric = db.query(Websites).filter(Websites.public_key == public_key).first()
        if metric is None:
            raise HTTPException(status_code=404, detail="Metric not found")

        timestamp_str = data.get("timestamp")
        # Если timestamp нет или некорректен, можно задать текущий момент
        if timestamp_str:
            timestamp = datetime.fromisoformat(timestamp_str)
        else:
            timestamp = datetime.now(timezone.utc)

        event_type = data.get("event", "unknown")
        event_data = data.get("event_data")

        # логирования времени
        if event_type == "time_spent" and event_data:
            duration_ms = event_data.get("duration_ms")
            logger.info(f"[Analytics] Time spent: {duration_ms} ms")



        new_stat = Statistics(
            metric_id=metric.id,
            event_type=data.get("event", "unknown"),
            timestamp=timestamp,
            user_agent=data.get("user_agent"),
            referrer=data.get("referrer"),
            event_data=data.get("event_data"),
            visitor_id=data.get("visitor_id"),
            ip_address=request.client.host
        )

        db.add(new_stat)
        db.commit()
        logger.info("[API] Event saved successfully.")
        return {"status": "success"}

    except Exception as e:
        logger.error(f"[API] Error processing event: {e}")
        raise HTTPException(status_code=400, detail="Invalid event payload")



@router.get("/stats/{public_key}")
def get_stats(public_key: str, db: Session = Depends(get_db)) -> Dict:
    site = db.query(Websites).filter(Websites.public_key == public_key).first()
    if not site:
        raise HTTPException(status_code=404, detail="Website not found")

    stats = db.query(Statistics).filter(Statistics.metric_id == site.id).all()

    if not stats:
        return {"message": "No statistics yet."}

    result = {
        "event_counts": {},
        "time_spent_ms": [],
        "timestamps": [],
    }

    for s in stats:
        event_type = s.event_type
        result["event_counts"][event_type] = result["event_counts"].get(event_type, 0) + 1

        if event_type == "time_spent" and s.event_data and "duration_ms" in s.event_data:
            result["time_spent_ms"].append(s.event_data["duration_ms"])

        result["timestamps"].append({
            "event_type": s.event_type,
            "timestamp": s.timestamp.isoformat(),
            "ip_address": s.ip_address
        })

    #uniqueip
    unique_ips_per_event = {}
    for s in stats:
        if s.event_type not in unique_ips_per_event:
            unique_ips_per_event[s.event_type] = set()
        if s.ip_address:
            unique_ips_per_event[s.event_type].add(s.ip_address)

    result["unique_ips_per_event"] = {
        event_type: len(ips)
        for event_type, ips in unique_ips_per_event.items()
    }

    # Среднее время на странице (в секундах)
    if result["time_spent_ms"]:
        result["average_time_spent_sec"] = round(
            sum(result["time_spent_ms"]) / len(result["time_spent_ms"]) / 1000, 2
        )
    else:
        result["average_time_spent_sec"] = 0

    return result