import uuid
from datetime import datetime, timezone
from enum import Enum
from dataclasses import dataclass, field


class UserRole(str, Enum):
    RECEPCIONISTA = "recepcionista"
    PROFISSIONAL = "profissional"
    PACIENTE = "paciente"


class UserStatus(str, Enum):
    ATIVO = "ativo"
    INATIVO = "inativo"


@dataclass
class User:
    email: str
    password_hash: str
    role: UserRole = UserRole.PACIENTE
    status: UserStatus = UserStatus.ATIVO
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))