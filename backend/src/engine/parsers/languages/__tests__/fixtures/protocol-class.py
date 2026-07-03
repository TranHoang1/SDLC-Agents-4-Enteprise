"""Protocol and ABC examples."""

from typing import Protocol, runtime_checkable
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@runtime_checkable
class Serializable(Protocol):
    """Protocol for serializable objects."""

    def serialize(self) -> bytes:
        ...

    def deserialize(self, data: bytes) -> 'Serializable':
        ...


class AbstractHandler(ABC):
    """Abstract base handler."""

    @abstractmethod
    def handle(self, request: dict) -> dict:
        """Handle a request."""
        ...

    @abstractmethod
    async def handle_async(self, request: dict) -> dict:
        """Handle a request asynchronously."""
        ...

    def log(self, message: str) -> None:
        """Log a message (concrete method)."""
        logger.info(message)


@dataclass
class Config:
    """Application configuration."""

    host: str = "localhost"
    port: int = 8080
    debug: bool = False
    tags: list = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            'host': self.host,
            'port': self.port,
            'debug': self.debug,
        }


@dataclass(frozen=True)
class ImmutablePoint:
    """Immutable 2D point."""
    x: float
    y: float

    def distance_to(self, other: 'ImmutablePoint') -> float:
        """Calculate distance to another point."""
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5
