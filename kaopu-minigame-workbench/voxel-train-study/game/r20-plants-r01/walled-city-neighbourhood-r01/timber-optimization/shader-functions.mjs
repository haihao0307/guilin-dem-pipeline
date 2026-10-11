// Source-span extraction: shader functions are retained byte for byte.
export function extractShaderFunctions(source) {
  const result = new Map();
  const pattern = /\b(?:void|float|int|bool|vec[234]|mat[234])\s+(\w+)\s*\([^;{}]*\)\s*\{/g;
  for (let match; (match = pattern.exec(source));) {
    let depth = 1, end = pattern.lastIndex;
    while (end < source.length && depth) {
      if (source[end] === '{') depth++;
      else if (source[end] === '}') depth--;
      end++;
    }
    if (depth) throw new Error('Unclosed shader function: ' + match[1]);
    if (result.has(match[1])) throw new Error('Overloaded function is unsupported: ' + match[1]);
    result.set(match[1], {name:match[1], start:match.index, end, text:source.slice(match.index,end)});
    pattern.lastIndex = end;
  }
  return result;
}
export function replaceShaderFunction(source, name, replacement) {
  const found = extractShaderFunctions(source).get(name);
  if (!found) throw new Error('Missing shader function: ' + name);
  return source.slice(0,found.start) + replacement + source.slice(found.end);
}
