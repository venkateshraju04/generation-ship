/**
 * Minimal RFC 4180 CSV parser: quoted fields, doubled quotes, LF or CRLF line endings.
 * Slices the source string rather than building fields character by character,
 * so the 35 MB HYG file parses in well under a second.
 */
export function parseCSV(text) {
  const rows = [];
  const n = text.length;
  let row = [];
  let i = 0;

  while (i < n) {
    let field;
    if (text.charCodeAt(i) === 34 /* " */) {
      let start = i + 1;
      let acc = '';
      for (;;) {
        const q = text.indexOf('"', start);
        if (q === -1) throw new Error(`Unterminated quoted field at offset ${i}`);
        if (text.charCodeAt(q + 1) === 34) {
          acc += text.slice(start, q + 1);
          start = q + 2;
          continue;
        }
        field = acc + text.slice(start, q);
        i = q + 1;
        break;
      }
    } else {
      let j = i;
      while (j < n) {
        const c = text.charCodeAt(j);
        if (c === 44 || c === 10 || c === 13) break;
        j++;
      }
      field = text.slice(i, j);
      i = j;
    }
    row.push(field);

    const c = text.charCodeAt(i);
    if (c === 44 /* , */) {
      i++;
      if (i === n) row.push('');
      continue;
    }
    rows.push(row);
    row = [];
    i += c === 13 && text.charCodeAt(i + 1) === 10 ? 2 : 1;
  }
  if (row.length) rows.push(row);
  return rows;
}

/** Parses CSV with a header row into objects; rows with the wrong column count are dropped. */
export function parseCSVObjects(text) {
  const [header, ...rows] = parseCSV(text);
  const out = [];
  for (const r of rows) {
    if (r.length !== header.length) continue;
    const o = {};
    for (let k = 0; k < header.length; k++) o[header[k]] = r[k];
    out.push(o);
  }
  return out;
}
