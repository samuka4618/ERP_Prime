import { createTicketSchema, addMessageSchema } from '../../src/modules/chamados/schemas/ticket';

describe('createTicketSchema', () => {
  it('deve aceitar payload válido', () => {
    const result = createTicketSchema.validate({
      category_id: 1,
      subject: 'Assunto do chamado com no mínimo cinco caracteres',
      description: 'Descrição com pelo menos dez caracteres aqui.'
    });
    expect(result.error).toBeUndefined();
    expect(result.value.priority).toBe('medium');
  });

  it('deve rejeitar subject curto', () => {
    const result = createTicketSchema.validate({
      category_id: 1,
      subject: 'Oi',
      description: 'Descrição com pelo menos dez caracteres.'
    });
    expect(result.error).toBeDefined();
  });

  it('deve rejeitar description curta', () => {
    const result = createTicketSchema.validate({
      category_id: 1,
      subject: 'Assunto válido aqui',
      description: 'Curta'
    });
    expect(result.error).toBeDefined();
  });
});

describe('addMessageSchema', () => {
  it('deve aceitar mensagem válida', () => {
    const result = addMessageSchema.validate({ message: 'Texto da mensagem' });
    expect(result.error).toBeUndefined();
  });

  it('deve rejeitar mensagem vazia', () => {
    const result = addMessageSchema.validate({ message: '' });
    expect(result.error).toBeDefined();
  });
});
