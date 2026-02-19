import { CNPJConsultationService } from './cnpj-consultation-service';

interface QueuedItem {
  registration_id: number;
  cnpj: string;
  timestamp: Date;
}

class CNPJQueueService {
  private queue: QueuedItem[] = [];
  private isProcessing: boolean = false;

  /**
   * Adiciona uma consulta à fila
   */
  enqueue(registration_id: number, cnpj: string): void {
    console.log(`📋 [QUEUE] Adicionando à fila: Registration ID ${registration_id}, CNPJ: ${cnpj}`);
    
    this.queue.push({
      registration_id,
      cnpj,
      timestamp: new Date()
    });

    console.log(`📊 [QUEUE] Fila atual: ${this.queue.length} item(s) na fila`);
    
    // Inicia processamento se não estiver processando
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Processa a fila sequencialmente
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 [QUEUE] Iniciando processamento da fila (${this.queue.length} item(s) aguardando)...`);

    while (this.queue.length > 0) {
      const item = this.queue[0];
      
      console.log(`\n🎯 [QUEUE] Processando: Registration ID ${item.registration_id}, CNPJ: ${item.cnpj}`);
      console.log(`📊 [QUEUE] Fila: ${this.queue.length} item(s) restante(s)`);

      try {
        await this.processItem(item);
        
        // Remove da fila após sucesso
        this.queue.shift();
        console.log(`✅ [QUEUE] Processado com sucesso: Registration ID ${item.registration_id}`);
        
      } catch (error) {
        console.error(`❌ [QUEUE] Erro ao processar Registration ID ${item.registration_id}:`, error);
        
        // Remove da fila mesmo com erro (evita ficar travado)
        this.queue.shift();
        console.log(`⚠️ [QUEUE] Item removido da fila devido a erro`);
      }

      // Aguarda 2 segundos entre processamentos para não sobrecarregar
      if (this.queue.length > 0) {
        console.log(`⏳ [QUEUE] Aguardando 2 segundos antes do próximo item...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    this.isProcessing = false;
    console.log(`✅ [QUEUE] Fila processada completamente`);
  }

  /**
   * Processa um item da fila
   */
  private async processItem(item: QueuedItem): Promise<void> {
    const result = await CNPJConsultationService.executeFullConsultation(item.registration_id, item.cnpj);
    
    if (!result.success) {
      throw new Error(result.message);
    }
  }

  /**
   * Retorna o status da fila
   */
  getStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing
    };
  }
}

// Exporta instância singleton
export const cnpjQueueService = new CNPJQueueService();

