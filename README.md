# DogCare

App Android (APK) para cuidar do seu cão. Funciona offline, sem conta e sem servidor; os dados ficam no celular.

- **Hoje:** anel de calorias da meta diária, água, passeio, peso, registro por voz (frase → registros estruturados), remédios do dia, alertas e linha do tempo.
- **Comida:** meta calórica (RER × fator de vida), gramas por dia, gráfico de 7 dias, porcentagem de petiscos e verificador "pode ou não pode?" de alimentos tóxicos.
- **Saúde:** vacinas e antiparasitários com vencimento e lembretes, remédios com horários, sintomas, consultas com fotos, documentos e sinais de emergência.
- **Evolução:** curva de peso com faixa do peso ideal, escore corporal 1–9, radar mensal de bem-estar (0–5), passeios por semana e marcos de comandos, hábitos e socialização.
- **Assistente:** respostas a partir dos registros; com um modelo Gemma `.task` importado, a IA local roda no aparelho.
- Backup e sincronização entre celulares por arquivo JSON (mesclar ou substituir). Tema claro, escuro ou automático.

O APK é gerado pelo GitHub Actions a cada push na `main` e publicado em **Releases**. A chave de assinatura é fixa, então cada versão instala por cima da anterior sem perder dados.

As orientações são gerais e não substituem o veterinário.
