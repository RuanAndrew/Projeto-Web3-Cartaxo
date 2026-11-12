import asyncio
import os

from passlib.context import CryptContext
from sqlalchemy import select

from src.core.config import settings
from src.domain.models import PerfilUsuario, StatusUsuario, Usuario
from src.infrastructure.database import SessionLocal

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed_admin() -> bool:
    async with SessionLocal() as db:
        existe_admin = (
            await db.execute(select(Usuario).where(Usuario.perfil == PerfilUsuario.ADMIN))
        ).scalar_one_or_none()
        if existe_admin:
            print(f"[seed] ADMIN já existe ({existe_admin.email}); nada a fazer.")
            return False

        admin = Usuario(
            nome="Administrador da Clínica",
            email=settings.admin_email,
            cpf=None,
            senha_hash=pwd_context.hash(settings.admin_senha),
            perfil=PerfilUsuario.ADMIN,
            status=StatusUsuario.ATIVO,
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)

        origem = (
            "variável de ambiente" if "ADMIN_SENHA" in os.environ else "default de dev"
        )
        print(f"[seed] ADMIN criado: {admin.email} ({admin.id}) — senha: {origem}")
        return True


async def seed_usuarios_genericos() -> int:
    contas = [
        (
            "Profissional de Teste",
            settings.profissional_email,
            settings.profissional_senha,
            PerfilUsuario.PROFISSIONAL,
        ),
        (
            "Atendente de Teste",
            settings.atendente_email,
            settings.atendente_senha,
            PerfilUsuario.ATENDENTE,
        ),
        (
            "Paciente de Teste",
            settings.paciente_email,
            settings.paciente_senha,
            PerfilUsuario.PACIENTE,
        ),
    ]

    criadas = 0
    for nome, email, senha, perfil in contas:
        async with SessionLocal() as db:
            existe = (
                await db.execute(select(Usuario).where(Usuario.email == email))
            ).scalar_one_or_none()
            if existe:
                print(f"[seed] {perfil.value} já existe ({email}); nada a fazer.")
                continue

            usuario = Usuario(
                nome=nome,
                email=email,
                cpf=None,
                senha_hash=pwd_context.hash(senha),
                perfil=perfil,
                status=StatusUsuario.ATIVO,
            )
            db.add(usuario)
            await db.commit()
            await db.refresh(usuario)
            criadas += 1
            print(f"[seed] {perfil.value} criado: {email} ({usuario.id})")

    return criadas


if __name__ == "__main__":
    asyncio.run(seed_admin())
    asyncio.run(seed_usuarios_genericos())
