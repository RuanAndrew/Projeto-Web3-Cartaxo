import logging
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import UsuarioAutenticado, exigir_perfil, get_current_user
from src.infrastructure import pacientes_client
from src.infrastructure.database import get_db
from src.models import Prontuario, ProntuarioVersao
from src.schemas import (
    CAMPOS_CLINICOS,
    ProntuarioCreate,
    ProntuarioOut,
    VersaoCreate,
    VersaoOut,
)

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Serviço de Prontuários",
    description=(
        "Registros clínicos textuais. Cada gravação gera uma nova versão: "
        "não existe edição destrutiva nem exclusão (UC-04)."
    ),
    version="2.0.0",
)

# Perfis com acesso ao conteudo clinico: PROFISSIONAL (le e grava) e
# PACIENTE (le apenas o proprio). ATENDENTE e ADMIN nao acessam.
somente_profissional = exigir_perfil("PROFISSIONAL")


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "servico": "prontuario-service"}


# --------------------------------------------------------------------------- #
# Auxiliares
# --------------------------------------------------------------------------- #
async def _obter_prontuario(
    db: AsyncSession, prontuario_id: UUID, para_atualizar: bool = False
) -> Prontuario:
    consulta = select(Prontuario).where(Prontuario.id == prontuario_id)
    if para_atualizar:
        consulta = consulta.with_for_update()
    prontuario = (await db.execute(consulta)).scalar_one_or_none()
    if prontuario is None:
        raise HTTPException(status_code=404, detail="Prontuário não encontrado.")
    return prontuario


async def _versao_atual(db: AsyncSession, prontuario_id: UUID) -> ProntuarioVersao:
    consulta = (
        select(ProntuarioVersao)
        .where(ProntuarioVersao.prontuario_id == prontuario_id)
        .order_by(ProntuarioVersao.numero.desc())
        .limit(1)
    )
    return (await db.execute(consulta)).scalar_one()


async def _autorizar_leitura(usuario: UsuarioAutenticado, prontuario: Prontuario) -> None:
    if usuario.perfil == "PROFISSIONAL":
        return
    if usuario.perfil == "PACIENTE":
        proprio = await pacientes_client.obter_paciente_id_da_conta(usuario.token)
        if proprio is not None and proprio == prontuario.paciente_id:
            return
    raise HTTPException(status_code=403, detail="Acesso não autorizado ao prontuário.")


def _saida(prontuario: Prontuario, versao: ProntuarioVersao) -> ProntuarioOut:
    return ProntuarioOut(
        id=prontuario.id,
        paciente_id=prontuario.paciente_id,
        profissional_id=prontuario.profissional_id,
        atendimento_id=prontuario.atendimento_id,
        criado_em=prontuario.criado_em,
        versao_atual=VersaoOut.model_validate(versao),
    )


# --------------------------------------------------------------------------- #
# Rotas
# --------------------------------------------------------------------------- #
@app.post("/prontuarios", response_model=ProntuarioOut, status_code=201, tags=["prontuarios"])
async def abrir_prontuario(
    dados: ProntuarioCreate,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(somente_profissional),
):
    if not await pacientes_client.paciente_existe(usuario.token, dados.paciente_id):
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")

    prontuario = Prontuario(
        paciente_id=dados.paciente_id,
        profissional_id=usuario.id,  # sempre o profissional autenticado
        atendimento_id=dados.atendimento_id,
    )
    db.add(prontuario)
    await db.flush()

    versao = ProntuarioVersao(
        prontuario_id=prontuario.id,
        numero=1,
        autor_id=usuario.id,
        **{campo: getattr(dados, campo) for campo in CAMPOS_CLINICOS},
    )
    db.add(versao)
    await db.commit()
    return _saida(prontuario, versao)


@app.get("/prontuarios", response_model=list[ProntuarioOut], tags=["prontuarios"])
async def listar_prontuarios(
    paciente_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(get_current_user),
):
    """Nunca lista prontuarios de varios pacientes de uma vez."""
    if usuario.perfil == "PROFISSIONAL":
        if paciente_id is None:
            raise HTTPException(status_code=422, detail="Informe o paciente_id.")
    elif usuario.perfil == "PACIENTE":
        proprio = await pacientes_client.obter_paciente_id_da_conta(usuario.token)
        if proprio is None:
            return []
        if paciente_id is not None and paciente_id != proprio:
            raise HTTPException(status_code=403, detail="Acesso não autorizado ao prontuário.")
        paciente_id = proprio
    else:
        raise HTTPException(status_code=403, detail="Acesso não autorizado.")

    consulta = (
        select(Prontuario)
        .where(Prontuario.paciente_id == paciente_id)
        .order_by(Prontuario.criado_em.desc())
    )
    prontuarios = (await db.execute(consulta)).scalars().all()
    return [_saida(p, await _versao_atual(db, p.id)) for p in prontuarios]


@app.get("/prontuarios/{prontuario_id}", response_model=ProntuarioOut, tags=["prontuarios"])
async def obter_prontuario(
    prontuario_id: UUID,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(get_current_user),
):
    prontuario = await _obter_prontuario(db, prontuario_id)
    await _autorizar_leitura(usuario, prontuario)
    return _saida(prontuario, await _versao_atual(db, prontuario.id))


@app.get(
    "/prontuarios/{prontuario_id}/versoes",
    response_model=list[VersaoOut],
    tags=["prontuarios"],
)
async def historico_de_versoes(
    prontuario_id: UUID,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(get_current_user),
):
    prontuario = await _obter_prontuario(db, prontuario_id)
    await _autorizar_leitura(usuario, prontuario)
    consulta = (
        select(ProntuarioVersao)
        .where(ProntuarioVersao.prontuario_id == prontuario.id)
        .order_by(ProntuarioVersao.numero)
    )
    return (await db.execute(consulta)).scalars().all()


@app.post(
    "/prontuarios/{prontuario_id}/versoes",
    response_model=VersaoOut,
    status_code=201,
    tags=["prontuarios"],
)
async def complementar_prontuario(
    prontuario_id: UUID,
    dados: VersaoCreate,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(somente_profissional),
):
    """Grava uma nova versao. A anterior permanece intacta."""
    prontuario = await _obter_prontuario(db, prontuario_id, para_atualizar=True)
    if prontuario.profissional_id != usuario.id:
        raise HTTPException(
            status_code=403,
            detail="Apenas o profissional responsável pode complementar o prontuário.",
        )

    atual = await _versao_atual(db, prontuario.id)
    conteudo = {
        campo: (
            getattr(dados, campo)
            if getattr(dados, campo) is not None
            else getattr(atual, campo)
        )
        for campo in CAMPOS_CLINICOS
    }
    if not any(conteudo.values()):
        raise HTTPException(status_code=422, detail="Informe pelo menos um campo clínico.")

    nova = ProntuarioVersao(
        prontuario_id=prontuario.id,
        numero=atual.numero + 1,
        autor_id=usuario.id,
        **conteudo,
    )
    db.add(nova)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Conflito de versão. Tente novamente.")
    return nova
