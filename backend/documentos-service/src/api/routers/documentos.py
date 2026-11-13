import logging
import re
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from uuid import UUID

from src.core.config import settings
from src.core.security import Usuario, exigir_profissional, get_current_user
from src.domain import schemas
from src.domain.validacao import TAMANHO_CABECALHO, detectar_tipo
from src.domain.models import Documento, StatusDocumento, TipoDocumento
from src.infrastructure import storage
from src.infrastructure.database import get_db

router = APIRouter(prefix="/documentos", tags=["Documentos Clínicos"])
logger = logging.getLogger("documentos")

TIPOS_PERMITIDOS = {"application/pdf", "image/png", "image/jpeg"}


def _nome_seguro(nome: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", nome)[:100]


def _obter_documento(db: Session, documento_id: int) -> Documento:
    doc = db.query(Documento).filter(
        Documento.id == documento_id, Documento.excluido_em.is_(None)
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    return doc


def _checar_acesso(doc: Documento, usuario: Usuario) -> None:
    if usuario.papel in ("profissional", "admin"):
        return
    # Paciente: só os próprios documentos e apenas os já liberados.
    if doc.paciente_id != usuario.id or doc.status != StatusDocumento.liberado:
        raise HTTPException(status_code=403, detail="Acesso negado ao documento.")


@router.post("", response_model=schemas.DocumentoResponse,
             status_code=status.HTTP_201_CREATED)
def criar_documento(
    paciente_id: UUID = Form(...),
    tipo: TipoDocumento = Form(...),
    titulo: str = Form(..., max_length=150),
    descricao: Optional[str] = Form(None),
    atendimento_id: Optional[int] = Form(None),
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    profissional: Usuario = Depends(exigir_profissional),
):
    if arquivo.content_type not in TIPOS_PERMITIDOS:
        raise HTTPException(
            status_code=415,
            detail="Formato inválido. Aceitos: PDF, PNG e JPEG.",
        )

    # Confere o conteúdo real: o content-type enviado pelo cliente não é confiável.
    cabecalho = arquivo.file.read(TAMANHO_CABECALHO)
    arquivo.file.seek(0)
    tipo_real = detectar_tipo(cabecalho)
    if tipo_real is None or tipo_real != arquivo.content_type:
        raise HTTPException(
            status_code=415,
            detail="O conteúdo do arquivo não corresponde a um PDF, PNG ou JPEG válido.",
        )

    arquivo.file.seek(0, 2)
    tamanho = arquivo.file.tell()
    arquivo.file.seek(0)
    if tamanho == 0 or tamanho > settings.tamanho_maximo_bytes:
        raise HTTPException(status_code=413, detail="Arquivo vazio ou acima do limite de 10 MB.")

    nome = _nome_seguro(arquivo.filename or "documento")
    chave = f"pacientes/{paciente_id}/{uuid.uuid4().hex}_{nome}"

    try:
        storage.enviar_arquivo(arquivo.file, chave, arquivo.content_type)
    except Exception:
        logger.exception("Falha ao enviar arquivo para o storage")
        raise HTTPException(status_code=502, detail="Falha ao armazenar o arquivo.")

    doc = Documento(
        paciente_id=paciente_id,
        profissional_id=profissional.id,
        atendimento_id=atendimento_id,
        tipo=tipo,
        titulo=titulo,
        descricao=descricao,
        chave_s3=chave,
        nome_arquivo=nome,
        content_type=tipo_real,
        tamanho_bytes=tamanho,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/paciente/{paciente_id}", response_model=List[schemas.DocumentoResponse])
def listar_documentos_paciente(
    paciente_id: UUID,
    tipo: Optional[TipoDocumento] = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    eh_profissional = usuario.papel in ("profissional", "admin")
    if not eh_profissional and usuario.id != paciente_id:
        raise HTTPException(status_code=403, detail="Você só pode ver os seus documentos.")

    consulta = db.query(Documento).filter(
        Documento.paciente_id == paciente_id, Documento.excluido_em.is_(None)
    )
    if not eh_profissional:
        consulta = consulta.filter(Documento.status == StatusDocumento.liberado)
    if tipo:
        consulta = consulta.filter(Documento.tipo == tipo)
    return consulta.order_by(Documento.criado_em.desc()).all()


@router.post("/{documento_id}/liberar", response_model=schemas.DocumentoResponse)
def liberar_documento(
    documento_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(exigir_profissional),
):
    doc = _obter_documento(db, documento_id)
    doc.status = StatusDocumento.liberado
    doc.liberado_em = datetime.utcnow()
    db.commit()
    db.refresh(doc)
    # TODO: publicar evento "documento.liberado" no RabbitMQ (notificacao-service)
    return doc


@router.get("/{documento_id}/url", response_model=schemas.UrlAssinadaResponse)
def obter_url_documento(
    documento_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    doc = _obter_documento(db, documento_id)
    _checar_acesso(doc, usuario)
    # TODO: registrar acesso na trilha de auditoria (UC-15)
    return schemas.UrlAssinadaResponse(
        url=storage.gerar_url_assinada(doc.chave_s3),
        expira_em_segundos=settings.url_assinada_expira_segundos,
    )


@router.delete("/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_documento(
    documento_id: int,
    db: Session = Depends(get_db),
    profissional: Usuario = Depends(exigir_profissional),
):
    """Exclusão lógica: o arquivo e o registro são preservados (guarda legal)."""
    doc = _obter_documento(db, documento_id)
    doc.excluido_em = datetime.utcnow()
    doc.excluido_por = profissional.id
    db.commit()
