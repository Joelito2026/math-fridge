import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    display_name = Column(String(80), nullable=True)
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

    # --- NEW: Privacy and Categorization ---
    is_public = Column(Boolean, default=False, nullable=False)
    category = Column(String(50), default="Popular", nullable=False)
    category_tags = Column(JSONB, default=list, nullable=False)
    dietary_tags = Column(JSONB, default=list, nullable=False)
    image_url = Column(String(2048), nullable=True)
    image_source = Column(String(20), nullable=True)
    image_source_url = Column(String(2048), nullable=True)
    image_attribution = Column(String(255), nullable=True)
    image_usage_confirmed = Column(Boolean, default=False, nullable=False)

    # The JSONB column: stores ingredients and steps without needing complex table joins
    recipe_data = Column(JSONB, nullable=False)

    saved_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="recipes")
