import React from 'react';

/**
 * Tokeniza HTML para destaque de sintaxe (tags, atributos, placeholders, strings).
 * Cores no estilo IDE para facilitar leitura por não-programadores.
 */
function tokenize(html: string): Array<{ type: string; value: string }> {
  const tokens: Array<{ type: string; value: string }> = [];
  let i = 0;
  const len = html.length;

  while (i < len) {
    // Placeholders {{...}}
    const placeholderMatch = html.slice(i).match(/^\{\{[^}]+\}\}/);
    if (placeholderMatch) {
      tokens.push({ type: 'placeholder', value: placeholderMatch[0] });
      i += placeholderMatch[0].length;
      continue;
    }
    // Tag de abertura ou fechamento
    const tagMatch = html.slice(i).match(/^<\/?[\w-]+\s*/);
    if (tagMatch) {
      tokens.push({ type: 'tag', value: tagMatch[0].trimStart() });
      i += tagMatch[0].length;
      continue;
    }
    // Fim de tag >
    if (html[i] === '>') {
      tokens.push({ type: 'tag', value: '>' });
      i += 1;
      continue;
    }
    // Nome de atributo (antes de =)
    const attrNameMatch = html.slice(i).match(/^[\w-]+(?=\s*=)/);
    if (attrNameMatch) {
      tokens.push({ type: 'attrName', value: attrNameMatch[0] });
      i += attrNameMatch[0].length;
      continue;
    }
    // String entre aspas duplas
    const dqMatch = html.slice(i).match(/^"[^"]*"/);
    if (dqMatch) {
      tokens.push({ type: 'string', value: dqMatch[0] });
      i += dqMatch[0].length;
      continue;
    }
    // String entre aspas simples
    const sqMatch = html.slice(i).match(/^'[^']*'/);
    if (sqMatch) {
      tokens.push({ type: 'string', value: sqMatch[0] });
      i += sqMatch[0].length;
      continue;
    }
    // Números (em valores de estilo)
    const numMatch = html.slice(i).match(/^\d+\.?\d*(?:px|em|%|rem)?/);
    if (numMatch) {
      tokens.push({ type: 'number', value: numMatch[0] });
      i += numMatch[0].length;
      continue;
    }
    // Caracteres especiais / uma letra
    const specialMatch = html.slice(i).match(/^[={\}];:#.]/);
    if (specialMatch) {
      tokens.push({ type: 'punctuation', value: specialMatch[0] });
      i += 1;
      continue;
    }
    // Qualquer outro caractere (texto, espaço, etc.)
    const nextSpecial = html.slice(i).search(/\{\{|<\/?[\w-]|[\w-]+\s*=|"[^"]*"|'[^']*'|[={\}];:#.]|\d/);
    const end = nextSpecial < 0 ? len - i : nextSpecial;
    const value = end ? html.slice(i, i + end) : html[i];
    if (value) {
      tokens.push({ type: 'text', value });
      i += value.length;
    } else {
      tokens.push({ type: 'text', value: html[i] });
      i += 1;
    }
  }
  return tokens;
}

const tokenColors: Record<string, string> = {
  tag: 'text-blue-600 dark:text-blue-400',           // tags HTML – azul
  attrName: 'text-amber-700 dark:text-amber-400',     // nomes de atributos – âmbar
  string: 'text-emerald-600 dark:text-emerald-400',  // strings – verde
  placeholder: 'text-orange-600 dark:text-orange-400 font-medium', // {{var}} – laranja
  number: 'text-teal-600 dark:text-teal-400',       // números – teal
  punctuation: 'text-gray-500 dark:text-gray-400',  // pontuação – cinza
  text: 'text-gray-800 dark:text-gray-200',          // texto normal
};

interface HtmlSyntaxHighlightProps {
  code: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renderiza HTML com destaque de sintaxe (cores tipo IDE).
 */
export const HtmlSyntaxHighlight: React.FC<HtmlSyntaxHighlightProps> = ({ code, className = '', style }) => {
  const tokens = tokenize(code);
  return (
    <pre
      className={`font-mono text-sm leading-relaxed whitespace-pre-wrap break-words m-0 ${className}`}
      style={style}
      aria-hidden
    >
      <code>
        {tokens.map((t, i) => {
          const escaped = t.value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
          return (
            <span key={i} className={tokenColors[t.type] ?? tokenColors.text} dangerouslySetInnerHTML={{ __html: escaped }} />
          );
        })}
      </code>
    </pre>
  );
};
