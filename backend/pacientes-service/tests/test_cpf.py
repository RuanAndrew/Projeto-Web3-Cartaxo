import pytest
from src.schemas import validar_cpf

@pytest.mark.parametrize("cpf", ["529.982.247-25", "111.444.777-35"])
def test_cpf_valido(cpf): assert len(validar_cpf(cpf)) == 11

@pytest.mark.parametrize("cpf", ["11111111111", "12345678900", "123"])
def test_cpf_invalido(cpf):
    with pytest.raises(ValueError): validar_cpf(cpf)
