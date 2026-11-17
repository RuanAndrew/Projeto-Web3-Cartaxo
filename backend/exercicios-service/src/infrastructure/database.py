from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Adicionado +psycopg2 na URL de conexão
DATABASE_URL = "postgresql+psycopg2://admin:adminpassword@localhost:5435/exercicios_db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()