import React from 'react';

function inlineMarkdown(text, keyPrefix) {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  return text.split(pattern).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) return <a key={key} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return part;
  });
}

export default function MarkdownContent({ content = '' }) {
  const lines = String(content).replace(/\r/g, '').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Heading = heading[1].length === 1 ? 'h2' : 'h3';
      blocks.push(React.createElement(Heading, { key: `heading-${index}` }, inlineMarkdown(heading[2], `heading-${index}`)));
      index += 1;
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(<li key={`li-${index}`}>{inlineMarkdown(lines[index].trim().replace(/^[-*+]\s+/, ''), `li-${index}`)}</li>);
        index += 1;
      }
      blocks.push(<ul key={`ul-${index}`}>{items}</ul>);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quote.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(<blockquote key={`quote-${index}`}>{inlineMarkdown(quote.join(' '), `quote-${index}`)}</blockquote>);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+|\s*[-*+]\s+|\s*>/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`p-${index}`}>{inlineMarkdown(paragraph.join(' '), `p-${index}`)}</p>);
  }

  return <div className="markdown-content">{blocks}</div>;
}
