# Boas práticas de frontend – ERP Prime

Documento de referência para manter acessibilidade, modo escuro e responsividade no frontend (React + Tailwind).

---

## 1. Modo escuro (dark mode)

### Contraste (WCAG)
- **Texto normal**: contraste mínimo 4.5:1 (AA) com o fundo.
- **Texto grande** (18px+ ou 14px bold+): mínimo 3:1.
- No modo escuro, evite `text-gray-500` ou `text-gray-600` sozinhos; use sempre variante escura, por exemplo:
  - `text-gray-500 dark:text-gray-400`
  - `text-gray-600 dark:text-gray-300`
  - `text-gray-700 dark:text-gray-200`
  - `text-gray-900 dark:text-white` (ou `dark:text-gray-50`)

### Padrão no projeto
- O arquivo `src/index.css` aplica **overrides globais** em `.dark` para `text-gray-*` e `bg-gray-50/100/white`, garantindo contraste mesmo quando um componente não define `dark:`.
- Novos componentes devem continuar usando **sempre** as variantes `dark:` para texto e fundo, para não depender só dos overrides.

### Cores semânticas
- Use `text-gray-900 dark:text-white` para texto principal.
- Use `text-gray-600 dark:text-gray-300` para texto secundário.
- Para fundos de card: `bg-white dark:bg-gray-800` (a classe `.card` já faz isso).
- Bordas: `border-gray-200 dark:border-gray-700`.

### Chips e badges coloridos
- **Evite** apenas `bg-green-50` ou `bg-amber-50` etc. no modo escuro: o texto fica ilegível (ex.: "teste atendente" no chip verde).
- Prefira sempre variante escura: `bg-green-50 dark:bg-green-900/50 border-green-200 dark:border-green-700` e texto `text-gray-900 dark:text-green-100` (ou `dark:text-white`).
- O `index.css` aplica **overrides globais** para `bg-*-50`, `bg-*-100`, `border-*-200` e `text-*-600/800` em `.dark`, garantindo contraste em chips/badges em todo o sistema.

---

## 2. Responsividade (mobile-first)

### Breakpoints Tailwind
- `sm:` 640px  
- `md:` 768px  
- `lg:` 1024px  
- `xl:` 1280px  
- `2xl:` 1536px  

Estilos base (sem prefixo) = mobile. Prefixos = “a partir de” esse tamanho.

### Boas práticas
- **Padding**: `p-4 sm:p-5 md:p-6` em containers principais.
- **Grids**: começar 1 coluna, depois aumentar:
  - `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- **Texto**: `text-sm md:text-base` quando fizer sentido.
- **Sidebar**: no Layout, em mobile o menu é overlay; em `lg:` vira coluna fixa.
- **Tabelas**: em telas pequenas considerar cards empilhados ou scroll horizontal com `overflow-x-auto` e `min-w-0` no container.

### Classes utilitárias no projeto
- `.grid-responsive` → 1 coluna, gap responsivo.
- `.grid-responsive-2` → 1 coluna em mobile, 2 em `sm:`.
- `.grid-responsive-3` → 1 → 2 → 3 colunas.
- `.grid-responsive-4` → 1 → 2 → 3 → 4 colunas.

### Evitar overflow horizontal
- Container principal: `min-w-0` em flex children.
- `overflow-x-hidden` no `body` e no `main` quando necessário.

---

## 3. Acessibilidade

- **Foco visível**: botões e links usam `focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2`. No modo escuro o offset está ajustado em `index.css`.
- **Labels**: todo `input`/`select`/`textarea` deve ter `<label>` associado (ou `aria-label`).
- **Contraste**: manter as regras de contraste acima; evitar “só cor” para informação (combinar com ícone ou texto).
- **Semântica**: usar `<button>` para ações, `<a>` para navegação; headings em ordem (`h1` → `h2` → …).

---

## 4. Componentes globais

- **`.card`**: já tem estilo claro/escuro; usar para blocos de conteúdo.
- **`.input`**: inputs com borda, placeholder e estados de foco; já com suporte a dark.
- **`.btn`, `.btn-primary`, `.btn-outline`, `.btn-secondary`**: já com dark e foco.

Ao criar novos componentes, reutilizar essas classes e adicionar sempre as variantes `dark:` onde houver texto ou fundo próprios.

---

## 5. Referências

- [WCAG 2.2 – Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [Tailwind – Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Tailwind – Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [web.dev – Color and contrast](https://web.dev/articles/color-and-contrast-accessibility)
