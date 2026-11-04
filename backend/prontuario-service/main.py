from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os
import sqlite3
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, model_validator


DATABASE_PATH = os.getenv(
	"PRONTUARIO_DATABASE_PATH",
	os.path.join(os.path.dirname(__file__), "prontuario.db"),
)


def get_connection() -> sqlite3.Connection:
	connection = sqlite3.connect(DATABASE_PATH)
	connection.row_factory = sqlite3.Row
	return connection


def initialize_database() -> None:
	database_directory = os.path.dirname(DATABASE_PATH)
	if database_directory:
		os.makedirs(database_directory, exist_ok=True)

	with get_connection() as connection:
		connection.execute(
			"""
			CREATE TABLE IF NOT EXISTS prontuarios (
				id TEXT PRIMARY KEY,
				patient_id TEXT NOT NULL,
				professional_id TEXT,
				appointment_id TEXT,
				anamnesis TEXT NOT NULL DEFAULT '',
				evolution TEXT NOT NULL DEFAULT '',
				diagnosis TEXT NOT NULL DEFAULT '',
				conduct TEXT NOT NULL DEFAULT '',
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)
			"""
		)
		connection.execute(
			"CREATE INDEX IF NOT EXISTS idx_prontuarios_patient_id "
			"ON prontuarios(patient_id)"
		)


def now() -> str:
	return datetime.now(timezone.utc).isoformat()


class ProntuarioBase(BaseModel):
	model_config = ConfigDict(str_strip_whitespace=True)

	patient_id: UUID
	professional_id: UUID | None = None
	appointment_id: UUID | None = None
	anamnesis: str = Field(default="", max_length=10000)
	evolution: str = Field(default="", max_length=10000)
	diagnosis: str = Field(default="", max_length=5000)
	conduct: str = Field(default="", max_length=10000)

	@model_validator(mode="after")
	def require_clinical_content(self) -> "ProntuarioBase":
		fields = (self.anamnesis, self.evolution, self.diagnosis, self.conduct)
		if not any(value for value in fields):
			raise ValueError("Informe pelo menos um campo clínico")
		return self


class ProntuarioCreate(ProntuarioBase):
	pass


class ProntuarioUpdate(BaseModel):
	model_config = ConfigDict(str_strip_whitespace=True)

	professional_id: UUID | None = None
	appointment_id: UUID | None = None
	anamnesis: str | None = Field(default=None, max_length=10000)
	evolution: str | None = Field(default=None, max_length=10000)
	diagnosis: str | None = Field(default=None, max_length=5000)
	conduct: str | None = Field(default=None, max_length=10000)


class ProntuarioResponse(ProntuarioBase):
	id: UUID
	created_at: datetime
	updated_at: datetime


def row_to_response(row: sqlite3.Row) -> ProntuarioResponse:
	return ProntuarioResponse(
		id=row["id"],
		patient_id=row["patient_id"],
		professional_id=row["professional_id"],
		appointment_id=row["appointment_id"],
		anamnesis=row["anamnesis"],
		evolution=row["evolution"],
		diagnosis=row["diagnosis"],
		conduct=row["conduct"],
		created_at=row["created_at"],
		updated_at=row["updated_at"],
	)


@asynccontextmanager
async def lifespan(_: FastAPI):
	initialize_database()
	yield


app = FastAPI(
	title="Prontuário Service",
	description="API para registros clínicos textuais vinculados aos pacientes.",
	version="1.0.0",
	lifespan=lifespan,
)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
	return {"status": "ok"}


@app.post(
	"/prontuarios",
	response_model=ProntuarioResponse,
	status_code=status.HTTP_201_CREATED,
	tags=["prontuarios"],
)
def create_prontuario(payload: ProntuarioCreate) -> ProntuarioResponse:
	record_id = str(uuid4())
	timestamp = now()

	with get_connection() as connection:
		connection.execute(
			"""
			INSERT INTO prontuarios (
				id, patient_id, professional_id, appointment_id,
				anamnesis, evolution, diagnosis, conduct, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			""",
			(
				record_id,
				str(payload.patient_id),
				str(payload.professional_id) if payload.professional_id else None,
				str(payload.appointment_id) if payload.appointment_id else None,
				payload.anamnesis,
				payload.evolution,
				payload.diagnosis,
				payload.conduct,
				timestamp,
				timestamp,
			),
		)
		row = connection.execute(
			"SELECT * FROM prontuarios WHERE id = ?", (record_id,)
		).fetchone()

	return row_to_response(row)


@app.get("/prontuarios", response_model=list[ProntuarioResponse], tags=["prontuarios"])
def list_prontuarios(
	patient_id: Annotated[UUID | None, Query()] = None,
) -> list[ProntuarioResponse]:
	query = "SELECT * FROM prontuarios"
	parameters: tuple[str, ...] = ()
	if patient_id:
		query += " WHERE patient_id = ?"
		parameters = (str(patient_id),)
	query += " ORDER BY created_at DESC"

	with get_connection() as connection:
		rows = connection.execute(query, parameters).fetchall()
	return [row_to_response(row) for row in rows]


@app.get("/prontuarios/{prontuario_id}", response_model=ProntuarioResponse, tags=["prontuarios"])
def get_prontuario(prontuario_id: UUID) -> ProntuarioResponse:
	with get_connection() as connection:
		row = connection.execute(
			"SELECT * FROM prontuarios WHERE id = ?", (str(prontuario_id),)
		).fetchone()

	if row is None:
		raise HTTPException(status_code=404, detail="Prontuário não encontrado")
	return row_to_response(row)


@app.patch("/prontuarios/{prontuario_id}", response_model=ProntuarioResponse, tags=["prontuarios"])
def update_prontuario(
	prontuario_id: UUID,
	payload: ProntuarioUpdate,
) -> ProntuarioResponse:
	changes = payload.model_dump(exclude_unset=True)
	if not changes:
		raise HTTPException(status_code=400, detail="Nenhum campo informado")

	for field in ("professional_id", "appointment_id"):
		if field in changes and changes[field] is not None:
			changes[field] = str(changes[field])

	with get_connection() as connection:
		current = connection.execute(
			"SELECT * FROM prontuarios WHERE id = ?", (str(prontuario_id),)
		).fetchone()
		if current is None:
			raise HTTPException(status_code=404, detail="Prontuário não encontrado")

		clinical_fields = ("anamnesis", "evolution", "diagnosis", "conduct")
		clinical_values = {
			field: changes.get(field, current[field]) for field in clinical_fields
		}
		if not any(clinical_values.values()):
			raise HTTPException(
				status_code=422,
				detail="Informe pelo menos um campo clínico",
			)

		changes["updated_at"] = now()
		assignments = ", ".join(f"{field} = ?" for field in changes)
		values = tuple(changes.values()) + (str(prontuario_id),)
		connection.execute(
			f"UPDATE prontuarios SET {assignments} WHERE id = ?", values
		)
		row = connection.execute(
			"SELECT * FROM prontuarios WHERE id = ?", (str(prontuario_id),)
		).fetchone()

	return row_to_response(row)
