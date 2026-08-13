# Projeto-Web3-Cartaxo

## Sistema de Clínica Otorrino e Fono

### Integrantes

* Jennifer de Oliveira
* Marcela Helena
* Jõao Pedro
* Ruan Andrew
* Heder Matheus
* Helmer Barcelos

### Descrição do Projeto

### Lista de Funcionalidades (A definir)

- Gestão de Pacientes: Cadastro completo, histórico médico, anamnese e consulta a prontuários eletrônicos.
- Gestão de Profissionais de Saúde: Cadastro de médicos otorrinolaringologistas, fonoaudiólogos e equipe administrativa com controle de agendas.
- Agendamento de Consultas e Exames: Marcação, remarcação, cancelamento e visualização de horários disponíveis.
-
-

## Tecnologias Pretendidas

- **Frontend**: HTML5, CSS3, JavaScript
- **Framework (A definir): React (SPA) ou Tailwind CSS para garantia de interface web responsiva.**
- **Backend:** Python com Django / FastAPI (divididos por microsserviços).
- **Banco de Dados:** PostgreSQL (uma instância por microsserviço).
- **Cache & Sessão:** Redis.
- **Conteinerização:** Docker e Docker Compose.
- **Testes:** Pytest.
- **Cloud Provider:** AWS (EC2, S3, RDS).
- **CI/CD:** GitHub Actions.
- **Observabilidade (A definir):** Prometheus + Grafana ou AWS CloudWatch para monitoramento e métricas.

## Arquitetura

A arquitetura do sistema é orientada a Microsserviços, com separação de responsabilidades e comunicação entre serviços via APIs REST e mensageria/eventos:

- **Domínios (A definir):**
  - *Serviço de Autenticação e Usuários*
  - *Serviço de Agendamento e Consultas*
- **Comunicação (A definir):** REST/HTTP (JSON) e/ou mensageria/eventos (RabbitMQ, Kafka, etc.).
- Persistência de Dados: Cada domínio possui seu próprio banco de dados PostgreSQL, integrado a uma camada de cache via Redis para otimização de performance.

## Práticas de Testes

- Testes Unitários:
- Testes de Integração:
- Testes de API / End-to-End (E2E):
- Cobertura de Código (Code Coverage):

## Práticas de DevOps, Conteinerização e Cloud

- Conteinerização
- Pipeline de CI/CD (GitHub Actions)
- Cloud (AWS)
- Observabilidade

## Práticas de Controle de Versão

- Estratégia de Branching:
  - `main`: Código estável, testado e pronto para produção.
  - `develop`: Código em ambiente de integração.
  - `feature/nome-da-feature`: Branchs temporárias para o desenvolvimento de novas funcionalidades.
- Code Review & Pull Requests (PRs): Nenhuma alteração entra nas branchs principais sem passar por *Pull Request* e aprovação prévia de pelo menos um integrante da equipe.
- Commits Padronizados: Mensagens claras e estruturadas seguindo a convenção *Conventional Commits* (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).

## Demais Práticas de Engenharia de Software, Produto & UX (A definir)
- Clean Code & Princípios SOLID: Aplicação de boas práticas de programação para manter o código legível, modular e testável.
- **Gestão Ágil: Organização de tarefas, *backlog* e acompanhamento de entregas por meio de quadros Kanban (GitHub Projects). (A definir)**
