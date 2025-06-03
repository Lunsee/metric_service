import secrets

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta, timezone
from app.db.database import Base
from sqlalchemy import JSON

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    #disabled = Column(Boolean, default=False)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    user = relationship("User")


class Websites(Base):
    __tablename__ = "website_users"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    public_key = Column(String, unique=True, nullable=False, default=lambda: secrets.token_urlsafe(16))

    user = relationship("User", backref="Websites")
    statistics = relationship("Statistics", back_populates="metric", cascade="all, delete-orphan")


class Statistics(Base):
    __tablename__ = 'users_metric_statistics'

    id = Column(Integer, primary_key=True, index=True)
    metric_id = Column(Integer, ForeignKey("website_users.id"))
    event_type = Column(String)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    user_agent = Column(String)
    referrer = Column(String)
    metric = relationship("Websites", back_populates="statistics")
    event_data = Column(JSON, nullable=True)
    visitor_id = Column(String, nullable=True)  # например, хеш от IP + user-agent
    ip_address = Column(String, nullable=True)