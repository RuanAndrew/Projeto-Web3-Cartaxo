import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import obter_usuario_atual, portador, exigir_perfil
from src.core.config import settings
from src.core.security import (
    criar_token_acesso,
    decodificar_token,
    gerar_refresh_token,
    hash_senha,
    verificar_senha,
)
from src.domain.models import PerfilUsuario, StatusUsuario, Usuario
from src.domain.schemas import (
    CadastroIn,
    LoginIn,
    LogoutIn,
    MensagemSaida,
    RenovarIn,
    SessaoOut,
    ValidacaoOut,
    UsuarioOut,
)
from src.infrastructure.database import get_db
from src.infrastructure.sessoes import (
    buscar_usuario_do_refresh,
    revogar_refresh,
    revogar_token_acesso,
    salvar_refresh,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _para_sessao_out(usuario: Usuario, access: str, vida_segundos: int, refresh: str) -> SessaoOut:
    return SessaoOut(
        access_token=access,
        refresh_token=refresh,
        token_type="bearer",
        expira_em=vida_segundos,
        usuario=UsuarioOut.model_validate(usuario),
    )


@router.post("/register", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def cadastrar_usuario(
    dados: CadastroIn,
    admin: Usuario = Depends(exigir_perfil(PerfilUsuario.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> UsuarioOut:
    usuario = Usuario(
        nome=dados.nome.strip(),
        email=dados.email.lower(),
        cpf=dados.cpf,
        senha_hash=hash_senha(dados.senha),
        perfil=dados.perfil,
        status=StatusUsuario.ATIVO,
    )
    db.add(usuario)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="E-mail ou CPF já cadastrado.",
        )
    await db.refresh(usuario)
    return UsuarioOut.model_validate(usuario)


@router.post("/login", response_model=SessaoOut)
async def login(
    dados: LoginIn,
    db: AsyncSession = Depends(get_db),
) -> SessaoOut:
    email = dados.email.lower()
    usuario = (
        await db.execute(select(Usuario).where(Usuario.email == email))
    ).scalar_one_or_none()

    if usuario is None or not verificar_senha(dados.senha, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if usuario.status != StatusUsuario.ATIVO:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta inativa. Procure a administração da clínica.",
        )

    access, jti, vida_segundos = criar_token_acesso(usuario)
    refresh = gerar_refresh_token()
    await salvar_refresh(
        refresh,
        str(usuario.id),
        ttl_segundos=settings.jwt_refresh_token_expire_days * 24 * 60 * 60,
    )
    return _para_sessao_out(usuario, access, vida_segundos, refresh)


@router.get("/me", response_model=UsuarioOut)
async def quem_sou_eu(
    usuario: Usuario = Depends(obter_usuario_atual),
) -> UsuarioOut:
    return UsuarioOut.model_validate(usuario)


@router.get("/validate", response_model=ValidacaoOut)
async def validar_token(
    usuario: Usuario = Depends(obter_usuario_atual),
) -> ValidacaoOut:
    return ValidacaoOut(
        valido=True,
        id=usuario.id,
        perfil=usuario.perfil,
        status=usuario.status,
        permissao_especial=usuario.permissao_especial,
    )


@router.post("/logout", response_model=MensagemSaida)
async def encerrar_sessao(
    dados: LogoutIn | None = None,
    usuario: Usuario = Depends(obter_usuario_atual),
    cred = Depends(portador),
    db: AsyncSession = Depends(get_db),
) -> MensagemSaida:
    try:
        claims = decodificar_token(cred.credentials)
        await revogar_token_acesso(claims["jti"], claims["exp"])
    except (JWTError, KeyError):
        pass

    if dados is not None and dados.refresh_token:
        await revogar_refresh(dados.refresh_token)

    return MensagemSaida(mensagem="Sessão encerrada.")


@router.post("/refresh", response_model=SessaoOut)
async def renovar_sessao(
    dados: RenovarIn,
    db: AsyncSession = Depends(get_db),
) -> SessaoOut:
    id_usuario = await buscar_usuario_do_refresh(dados.refresh_token)
    if id_usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido ou expirado.",
        )

    try:
        id_uuid = uuid.UUID(id_usuario)
    except ValueError:
        raise HTTPException(status_code=401, detail="Refresh token inválido.")

    usuario = (
        await db.execute(select(Usuario).where(Usuario.id == id_uuid))
    ).scalar_one_or_none()
    if usuario is None:
        await revogar_refresh(dados.refresh_token)
        raise HTTPException(status_code=401, detail="Refresh token inválido.")

    if usuario.status != StatusUsuario.ATIVO:
        await revogar_refresh(dados.refresh_token)
        raise HTTPException(status_code=403, detail="Conta inativa.")

    await revogar_refresh(dados.refresh_token)
    access, jti, vida_segundos = criar_token_acesso(usuario)
    novo_refresh = gerar_refresh_token()
    await salvar_refresh(
        novo_refresh,
        str(usuario.id),
        ttl_segundos=settings.jwt_refresh_token_expire_days * 24 * 60 * 60,
    )
    return _para_sessao_out(usuario, access, vida_segundos, novo_refresh)
