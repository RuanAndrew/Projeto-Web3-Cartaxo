# Sistema de Gestão para Clínica Multiprofissional


### Sobre o projeto
O sistema é uma plataforma web de gestão para uma clínica de múltiplas especialidades, desenvolvida com arquitetura de microsserviços. Seu objetivo é centralizar o cadastro de pacientes e profissionais de saúde, o agendamento de consultas, o gerenciamento de prontuários eletrônicos e o acompanhamento dos tratamentos.

A plataforma busca facilitar a organização dos atendimentos, permitindo o registro de informações clínicas, a consulta ao histórico dos pacientes e o gerenciamento de documentos, exames e exercícios terapêuticos, conforme as necessidades de cada especialidade.

A arquitetura foi planejada para manter os serviços independentes, facilitar a manutenção e permitir a evolução do sistema.

### Status do projeto
Projeto acadêmico em desenvolvimento, com foco na aplicação prática de arquitetura de microsserviços, desenvolvimento web, persistência de dados, integração entre APIs e testes de software.

### Como rodar o projeto

Requisitos: Node.js, npm, Docker e Docker Compose.

cd frontend

npm ci

npm run dev

### Integrantes

* Jennifer de Oliveira
* Marcela Helena
* Jõao Pedro
* Ruan Andrew
* Heder Matheus
* Helmer Barcelos
* João Barbosa

## Funcionalidades do Sistema

- **Gestão de Pacientes e Prontuários**: Cadastro, consulta e atualização dos dados pessoais e informações de contato dos pacientes.
- **Gestão de Profissionais**: Cadastro de médicos profissionais de saúde, especialidades e equipe administrativa, com controle dinâmico de agendas.
- **Agendamento**: Marcação, remarcação e cancelamento de consultas, com verificação de disponibilidade de horários e prevenção de conflitos.
- **Prontuário Eletrônico**: registro de anamneses, evoluções clínicas e histórico de atendimentos, permitindo o acompanhamento do paciente ao longo do tratamento.
- **Evolução Multimídia**: Upload e armazenamento seguro (via AWS S3) de gravações de voz e vídeos curtos, permitindo aos fonoaudiólogos comparar visualmente e auditivamente o "antes e depois" do tratamento, respeitando as permissões de acesso.
- **Gestão de Receitas e Exames**: registro e consulta de receitas, solicitações de exames e respectivos resultados.
- **Exercícios Terapêuticos**: cadastro e prescrição de exercícios, com registro da realização e acompanhamento da evolução dos pacientes.
- **Controle de Acesso**: autenticação de usuários e gerenciamento de permissões de acordo com seus perfis.
- **Portal do Paciente**: acesso às informações e funcionalidades disponibilizadas ao paciente, conforme suas permissões, incluindo consultas agendadas, histórico e documentos disponíveis.
- **Comunicação Integrada**: Envio de notificações e lembretes automatizados aos pacientes.

## Tecnologias Usadas

| Categoria | Tecnologias |
|---|---|
| Frontend | HTML5, CSS3, JavaScript, React (SPA), Tailwind CSS |
| Backend | Python via FastAPI (Microsserviços) |
| Bancos de Dados | PostgreSQL (uma instância por serviço) |
| Cache e Sessão | Redis |
| Infraestrutura e Cloud | Docker, Docker Compose, AWS (EC2, S3) |
| Observabilidade | Prometheus, Grafana, OpenTelemetry |
| CI/CD e Qualidade | GitHub Actions, Pytest |

## Arquitetura de Software

O sistema adota uma arquitetura orientada a Microsserviços, desenhada sob as diretrizes do Domain-Driven Design (DDD) para focar em agregados, entidades e serviços de domínio. A proposta busca reduzir o acoplamento entre os componentes, facilitar o desenvolvimento independente e permitir a manutenção e evolução de cada serviço.

- **API Gateway**: Ponto único de entrada e roteamento para os serviços internos.
- **Domínios**: Divididos em "Serviço de Autenticação/Usuários" e "Serviço de Agendamento/Consultas".
- **Comunicação Síncrona**: Interações diretas entre serviços via REST/HTTP utilizando FastAPI.
- **Comunicação Assíncrona**: Processamento em background e eventos geridos por mensageria com RabbitMQ.
- **Persistência de Dados**: Cada microsserviço será responsável pelos próprios dados, utilizando PostgreSQL para persistência. A separação dos dados busca preservar a autonomia dos serviços e evitar dependências diretas entre suas estruturas internas. O Redis poderá ser utilizado para cache e gerenciamento de sessões, conforme as necessidades do sistema.

## Microsserviços previstos
- Serviço de Autenticação e Usuários: responsável pela autenticação, pelos perfis de acesso e pelas permissões dos usuários.
- Serviço de Pacientes: responsável pelo cadastro e gerenciamento dos dados dos pacientes.
- Serviço de Profissionais: responsável pelo cadastro dos profissionais de saúde, suas especialidades e informações de disponibilidade.
- Serviço de Agendamentos: responsável pelo gerenciamento das consultas, incluindo marcação, remarcação, cancelamento e disponibilidade de horários.
- Serviço de Prontuários Clínicos: responsável pelo registro de anamneses, evoluções clínicas e históricos de atendimento, incluindo informações específicas das especialidades atendidas.
- Serviço de Documentos Clínicos: responsável pelo gerenciamento de receitas, exames e arquivos associados aos atendimentos.
- Serviço de Exercícios Terapêuticos: responsável pelo gerenciamento dos exercícios prescritos e pelo acompanhamento da realização e evolução dos pacientes.

## Práticas de Engenharia e Qualidade

O ciclo de desenvolvimento seguira os seguintes princípios:

- **Garantia de Qualidade (QA)**: Implementação de Testes Unitários, de Integração e End-to-End (E2E), com monitoramento constante da Cobertura de Código.
- **DevOps e Integração Contínua**: Uso de contêineres para padronização de ambientes e GitHub Actions para esteiras automatizadas de CI/CD.
- **Controle de Versão**: Fluxo baseado em branchs com main (produção), develop (integração) e feature/ (desenvolvimento).
- **Revisão de Código**: Nenhuma alteração é mesclada sem um Pull Request aprovado e commits seguindo o padrão Conventional Commits.
- **Padrões de Projeto**: Escrita baseada em Clean Code e princípios SOLID para garantir um sistema modular e testável.
- **Gestão Ágil**: Acompanhamento de backlog e entregas utilizando quadros Kanban no GitHub Projects, aplicando tambem cerimônias e técnicas do framework Scrum.
