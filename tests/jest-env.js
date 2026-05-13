/** Chave fixa apenas para testes (32 bytes em hex). */
if (!process.env.SUBSCRIPTION_ENCRYPTION_KEY) {
  process.env.SUBSCRIPTION_ENCRYPTION_KEY = 'aa'.repeat(32);
}
