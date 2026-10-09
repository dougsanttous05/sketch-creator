export const parseNumber = text => text.trim() === '' ? NaN : Number(text);
export const displayNumber = value => Number.isFinite(value) ? String(value) : '';
