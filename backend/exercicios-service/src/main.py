import logging
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import UsuarioAutenticado, exigir_perfil
from src.infrastructure import pacientes_client
from src.infrastructure.database import get_db
from src.models import Exercicio, Prescricao, RegistroRealizacao
from src.schemas import (
    ExercicioCreate,
    ExercicioOut,
    PrescricaoCreate,
    PrescricaoOut,
    PrescricaoUpdate,
    RegistroCreate,
    RegistroOut,
)

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Serviço de Exercícios Terapêuticos",
    description=(
        "Catálogo de exercícios, prescrições e registros de realização. "
        "A marcação de realização é autodeclarada pelo paciente (UC-09)."
    ),
    version="2.0.0",
)

# PROFISSIONAL: cataloga, prescreve e acompanha.  PACIENTE: le as proprias
# prescricoes e registra a realizacao.  ATENDENTE e ADMIN nao acessam
# (o nivel de dor e dado de saude).
somente_profissional = exigir_perfil("PROFISSIONAL")
somente_paciente = exigir_perfil("PACIENTE")
profissional_ou_paciente = exigir_perfil("PROFISSIONAL", "PACIENTE")


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "servico": "exercicios-service"}


# --------------------------------------------------------------------------- #
# Auxiliares
# --------------------------------------------------------------------------- #
def _saida_prescricao(prescricao: Prescricao, exercicio: Exercicio) -> PrescricaoOut:
    return PrescricaoOut(
        id=prescricao.id,
        paciente_id=prescricao.paciente_id,
        profissional_id=prescricao.profissional_id,
        frequencia=prescricao.frequencia,
        ativa=prescricao.ativa,
        criado_em=prescricao.criado_em,
        exercicio=ExercicioOut.model_validate(exercicio),
    )


async def _obter_prescricao(db: AsyncSession, prescricao_id: UUID) -> Prescricao:
    prescricao = await db.get(Prescricao, prescricao_id)
    if prescricao is None:
        raise HTTPException(status_code=404, detail="Prescrição não encontrada.")
    return prescricao


async def _paciente_da_conta(usuario: UsuarioAutenticado) -> UUID | None:
    return await pacientes_client.obter_paciente_id_da_conta(usuario.token)


async def _autorizar_leitura(usuario: UsuarioAutenticado, prescricao: Prescricao) -> None:
    if usuario.perfil == "PROFISSIONAL":
        return
    if usuario.perfil == "PACIENTE":
        proprio = await _paciente_da_conta(usuario)
        if proprio is not None and proprio == prescricao.paciente_id:
            return
    raise HTTPException(status_code=403, detail="Acesso não autorizado à prescrição.")


# --------------------------------------------------------------------------- #
# Catalogo
# --------------------------------------------------------------------------- #
@app.post(
    "/exercicios/catalogo",
    response_model=ExercicioOut,
    status_code=201,
    tags=["catalogo"],
)
async def criar_exercicio(
    dados: ExercicioCreate,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(somente_profissional),
):
    exercicio = Exercicio(**dados.model_dump(), criado_por=usuario.id)
    db.add(exercicio)
    await db.commit()
    return exercicio


@app.get("/exercicios/catalogo", response_model=list[ExercicioOut], tags=["catalogo"])
async def listar_catalogo(
    db: AsyncSession = Depends(get_db),
    _: UsuarioAutenticado = Depends(profissional_ou_paciente),
):
    consulta = select(Exercicio).order_by(Exercicio.nome)
    return (await db.execute(consulta)).scalars().all()


@app.get("/exercicios/catalogo/{exercicio_id}", response_model=ExercicioOut, tags=["catalogo"])
async def obter_exercicio(
    exercicio_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: UsuarioAutenticado = Depends(profissional_ou_paciente),
):
    exercicio = await db.get(Exercicio, exercicio_id)
    if exercicio is None:
        raise HTTPException(status_code=404, detail="Exercício não encontrado.")
    return exercicio


# --------------------------------------------------------------------------- #
# Prescricoes
# --------------------------------------------------------------------------- #
@app.post(
    "/exercicios/prescricoes",
    response_model=PrescricaoOut,
    status_code=201,
    tags=["prescricoes"],
)
async def prescrever(
    dados: PrescricaoCreate,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(somente_profissional),
):
    exercicio = await db.get(Exercicio, dados.exercicio_id)
    if exercicio is None:
        raise HTTPException(status_code=404, detail="Exercício não encontrado no catálogo.")
    if not await pacientes_client.paciente_existe(usuario.token, dados.paciente_id):
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")

    prescricao = Prescricao(
        paciente_id=dados.paciente_id,
        profissional_id=usuario.id,  # sempre o profissional autenticado
        exercicio_id=exercicio.id,
        frequencia=dados.frequencia,
    )
    db.add(prescricao)
    await db.commit()
    return _saida_prescricao(prescricao, exercicio)


@app.get("/exercicios/prescricoes", response_model=list[PrescricaoOut], tags=["prescricoes"])
async def listar_prescricoes(
    paciente_id: UUID | None = None,
    apenas_ativas: bool = True,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(profissional_ou_paciente),
):
    """Nunca lista prescricoes de varios pacientes de uma vez."""
    if usuario.perfil == "PROFISSIONAL":
        if paciente_id is None:
            raise HTTPException(status_code=422, detail="Informe o paciente_id.")
    else:  # PACIENTE
        proprio = await _paciente_da_conta(usuario)
        if proprio is None:
            return []
        if paciente_id is not None and paciente_id != proprio:
            raise HTTPException(status_code=403, detail="Acesso não autorizado à prescrição.")
        paciente_id = proprio

    consulta = (
        select(Prescricao, Exercicio)
        .join(Exercicio, Prescricao.exercicio_id == Exercicio.id)
        .where(Prescricao.paciente_id == paciente_id)
        .order_by(Prescricao.criado_em.desc())
    )
    if apenas_ativas:
        consulta = consulta.where(Prescricao.ativa.is_(True))
    linhas = (await db.execute(consulta)).all()
    return [_saida_prescricao(p, e) for p, e in linhas]


@app.get(
    "/exercicios/prescricoes/{prescricao_id}",
    response_model=PrescricaoOut,
    tags=["prescricoes"],
)
async def obter_prescricao(
    prescricao_id: UUID,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(profissional_ou_paciente),
):
    prescricao = await _obter_prescricao(db, prescricao_id)
    await _autorizar_leitura(usuario, prescricao)
    exercicio = await db.get(Exercicio, prescricao.exercicio_id)
    return _saida_prescricao(prescricao, exercicio)


@app.patch(
    "/exercicios/prescricoes/{prescricao_id}",
    response_model=PrescricaoOut,
    tags=["prescricoes"],
)
async def alterar_prescricao(
    prescricao_id: UUID,
    dados: PrescricaoUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(somente_profissional),
):
    """Altera a frequencia ou inativa/reativa. Nao ha exclusao (preserva o historico)."""
    prescricao = await _obter_prescricao(db, prescricao_id)
    if prescricao.profissional_id != usuario.id:
        raise HTTPException(
            status_code=403,
            detail="Apenas o profissional responsável pode alterar a prescrição.",
        )
    if dados.frequencia is not None:
        prescricao.frequencia = dados.frequencia
    if dados.ativa is not None:
        prescricao.ativa = dados.ativa
    await db.commit()
    exercicio = await db.get(Exercicio, prescricao.exercicio_id)
    return _saida_prescricao(prescricao, exercicio)


# --------------------------------------------------------------------------- #
# Registros de realizacao (autodeclarados)
# --------------------------------------------------------------------------- #
@app.post(
    "/exercicios/prescricoes/{prescricao_id}/registros",
    response_model=RegistroOut,
    status_code=201,
    tags=["registros"],
)
async def registrar_realizacao(
    prescricao_id: UUID,
    dados: RegistroCreate,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(somente_paciente),
):
    prescricao = await _obter_prescricao(db, prescricao_id)
    proprio = await _paciente_da_conta(usuario)
    if proprio is None or proprio != prescricao.paciente_id:
        raise HTTPException(status_code=403, detail="Acesso não autorizado à prescrição.")
    if not prescricao.ativa:
        raise HTTPException(status_code=409, detail="A prescrição está inativa.")

    registro = RegistroRealizacao(
        prescricao_id=prescricao.id,
        nivel_dor=dados.nivel_dor,
        observacoes=dados.observacoes,
    )
    db.add(registro)
    await db.commit()
    return registro


@app.get(
    "/exercicios/prescricoes/{prescricao_id}/registros",
    response_model=list[RegistroOut],
    tags=["registros"],
)
async def listar_registros(
    prescricao_id: UUID,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(profissional_ou_paciente),
):
    prescricao = await _obter_prescricao(db, prescricao_id)
    await _autorizar_leitura(usuario, prescricao)
    consulta = (
        select(RegistroRealizacao)
        .where(RegistroRealizacao.prescricao_id == prescricao.id)
        .order_by(RegistroRealizacao.realizado_em.desc())
    )
    return (await db.execute(consulta)).scalars().all()
