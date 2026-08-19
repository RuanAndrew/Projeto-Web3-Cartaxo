# Sistema para Clínica de Otorrinolaringologia e Fonoaudiologia

### Integrantes

* Jennifer de Oliveira
* Marcela Helena
* Jõao Pedro
* Ruan Andrew
* Heder Matheus
* Helmer Barcelos

## Funcionalidades do Sistema

- **Gestão de Pacientes e Prontuários**: Cadastro completo, histórico médico e anamnese eletrônica. Inclui prontuários especializados com componentes interativos para preenchimento de audiogramas e curvas timpanométricas.
- **Gestão de Profissionais**: Cadastro de médicos otorrinolaringologistas, fonoaudiólogos e equipe administrativa, com controle dinâmico de agendas.
- **Agendamento e Financeiro**: Marcação, remarcação e cancelamento de consultas/exames em tempo real, integrado a um módulo completo de faturamento.
- **Evolução Multimídia**: Upload e armazenamento seguro (via AWS S3) de gravações de voz e vídeos curtos, permitindo aos fonoaudiólogos comparar visualmente e auditivamente o "antes e depois" do tratamento.
- **Portal do Paciente com Gamificação**: Área exclusiva para visualização de histórico, download de receitas, reagendamentos e integração com telemedicina. Inclui um módulo gamificado onde os pacientes marcam a conclusão de exercícios vocais prescritos, acumulando "ofensivas" de engajamento.
- **Assistência por Inteligência Artificial**: Integração com modelo open-source (Whisper/Python) para transcrever automaticamente os áudios das consultas para o campo de anamnese do sistema.
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

O sistema adota uma arquitetura orientada a Microsserviços, desenhada sob as diretrizes do Domain-Driven Design (DDD) para focar em agregados, entidades e serviços de domínio.

- **API Gateway**: Ponto único de entrada e roteamento para os serviços internos.
- **Domínios**: Divididos em "Serviço de Autenticação/Usuários" e "Serviço de Agendamento/Consultas".
- **Comunicação Síncrona**: Interações diretas entre serviços via REST/HTTP utilizando FastAPI.
- **Comunicação Assíncrona**: Processamento em background e eventos geridos por mensageria com RabbitMQ.
- **Persistência de Dados**: Cada microsserviço possui seu próprio banco PostgreSQL, reduzindo o acoplamento e otimizando a performance em conjunto com o Redis.

## Práticas de Engenharia e Qualidade

O ciclo de desenvolvimento seguira os seguintes princípios:

- **Garantia de Qualidade (QA)**: Implementação de Testes Unitários, de Integração e End-to-End (E2E), com monitoramento constante da Cobertura de Código.
- **DevOps e Integração Contínua**: Uso de contêineres para padronização de ambientes e GitHub Actions para esteiras automatizadas de CI/CD.
- **Controle de Versão**: Fluxo baseado em branchs com main (produção), develop (integração) e feature/ (desenvolvimento).
- **Revisão de Código**: Nenhuma alteração é mesclada sem um Pull Request aprovado e commits seguindo o padrão Conventional Commits.
- **Padrões de Projeto**: Escrita baseada em Clean Code e princípios SOLID para garantir um sistema modular e testável.
- **Gestão Ágil**: Acompanhamento de backlog e entregas utilizando quadros Kanban no GitHub Projects, aplicando tambem cerimônias e técnicas do framework Scrum.