export function cleanMediaTitle(title: string): string {
  return title
    .replace(/مترجم|مشاهدة|فيلم|مسلسل/g, '')
    .replace(/الموسم\s+([^\s]+)/g, '')
    .replace(/الحلقة\s+([^\s]+)/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log(cleanMediaTitle('مسلسل Euphoria الموسم الثاني'));
console.log(cleanMediaTitle('مسلسل Love Story الموسم الأول الحلقة 4'));
console.log(cleanMediaTitle('مسلسل 30 Monedas الموسم 2 الحلقة 5 مترجم'));
