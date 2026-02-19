# Guia de Adição de Módulos - ERP PRIME

Este documento explica como adicionar novos módulos à sidebar do ERP PRIME.

## Estrutura da Sidebar

A sidebar está organizada em **seções** que podem ser expandidas/colapsadas:

1. **Dashboard** - Sempre visível, não colapsável
2. **Módulos** - Seção colapsável contendo todos os módulos do sistema
3. **Administração** - Seção colapsável apenas para administradores

## Como Adicionar um Novo Módulo

### 1. Adicionar o Módulo na Seção "Módulos"

Edite o arquivo `frontend/src/components/Sidebar.tsx` e localize a seção `modules`:

```typescript
{
  id: 'modules',
  name: 'Módulos',
  icon: FolderOpen,
  items: [
    {
      name: 'Chamados',
      href: '/tickets',
      icon: Ticket
    },
    {
      name: 'Cadastros',
      href: '/client-registrations',
      icon: Building2
    },
    // ADICIONE SEU NOVO MÓDULO AQUI
    {
      name: 'Novo Módulo',
      href: '/novo-modulo',
      icon: SeuIcone, // Importe do lucide-react
      badge: 'Novo' // Opcional: badge para destacar
    }
  ],
  collapsible: true
}
```

### 2. Adicionar Rotas no App.tsx

Edite `frontend/src/App.tsx` e adicione as rotas do novo módulo:

```typescript
<Route path="novo-modulo" element={<NovoModulo />} />
<Route path="novo-modulo/:id" element={<NovoModuloDetail />} />
```

### 3. Criar Páginas do Módulo

Crie os componentes de página em `frontend/src/pages/`:
- `NovoModulo.tsx` - Lista principal
- `NovoModuloDetail.tsx` - Detalhes
- `NovoModuloForm.tsx` - Formulário (opcional)

### 4. Adicionar Ícones

Importe ícones do `lucide-react` no topo do arquivo `Sidebar.tsx`:

```typescript
import { SeuIcone } from 'lucide-react';
```

## Exemplo Completo: Adicionar Módulo de Vendas

### 1. Atualizar Sidebar.tsx

```typescript
import { ShoppingCart } from 'lucide-react'; // Adicionar import

// Na seção modules:
{
  name: 'Vendas',
  href: '/vendas',
  icon: ShoppingCart,
  badge: 'Novo' // Opcional
}
```

### 2. Adicionar Rotas

```typescript
// Em App.tsx
import Vendas from './pages/Vendas';
import VendaDetail from './pages/VendaDetail';

<Route path="vendas" element={<Vendas />} />
<Route path="vendas/:id" element={<VendaDetail />} />
```

### 3. Criar Páginas

Criar `frontend/src/pages/Vendas.tsx` e `frontend/src/pages/VendaDetail.tsx`

## Estrutura de Permissões

### Módulo Visível para Todos
```typescript
{
  name: 'Módulo Público',
  href: '/modulo-publico',
  icon: Icone
}
```

### Módulo Apenas para Admin
Crie uma nova seção ou adicione na seção "Administração":

```typescript
{
  id: 'administration',
  name: 'Administração',
  icon: Shield,
  items: [
    // ... itens existentes
    {
      name: 'Novo Módulo Admin',
      href: '/admin-modulo',
      icon: Icone
    }
  ],
  adminOnly: true, // Importante!
  collapsible: true
}
```

## Recursos Avançados

### Badges
Adicione badges para destacar novos módulos ou mostrar contadores:

```typescript
{
  name: 'Módulo com Badge',
  href: '/modulo',
  icon: Icone,
  badge: 'Novo' // ou um número: badge: 5
}
```

### Módulos Aninhados (Futuro)
Para módulos com submenus, você pode expandir a estrutura:

```typescript
{
  name: 'Módulo Principal',
  href: '/modulo',
  icon: Icone,
  children: [
    { name: 'Subitem 1', href: '/modulo/sub1', icon: Icone2 },
    { name: 'Subitem 2', href: '/modulo/sub2', icon: Icone3 }
  ]
}
```

## Boas Práticas

1. **Nomes Consistentes**: Use nomes claros e descritivos
2. **Ícones Apropriados**: Escolha ícones do lucide-react que representem bem o módulo
3. **Organização**: Mantenha módulos relacionados próximos
4. **Permissões**: Sempre defina `adminOnly: true` para módulos administrativos
5. **Hrefs Consistentes**: Use padrão `/modulo-nome` em minúsculas com hífens

## Estrutura de Arquivos Recomendada

```
frontend/src/
├── pages/
│   ├── NovoModulo/
│   │   ├── index.tsx          # Lista principal
│   │   ├── NovoModuloDetail.tsx
│   │   └── NovoModuloForm.tsx
│   └── ...
├── components/
│   └── Sidebar.tsx            # Navegação
└── App.tsx                    # Rotas
```

## Notas

- A sidebar salva o estado de expansão das seções no `localStorage`
- Módulos são automaticamente filtrados baseado em permissões do usuário
- A sidebar se adapta automaticamente quando colapsada (mostra apenas ícones)
- Novos módulos aparecem automaticamente na seção "Módulos" quando adicionados

