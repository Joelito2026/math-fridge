import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Establishes the relationship to the saved recipes
    recipes = relationship("SavedRecipe", back_populates="owner", cascade="all, delete-orphan")

class SavedRecipe(Base):
    __tablename__ = "saved_recipes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source_url = Column(String, nullable=False)
    title = Column(String(255), nullable=False)
    target_yield = Column(String(50), nullable=False)
    
    # The JSONB column: stores ingredients and steps without needing complex table joins
    recipe_data = Column(JSONB, nullable=False)
    
    saved_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="recipes")