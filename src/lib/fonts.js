export const HEADING_FONTS = [
    {id:'theme',label:'Theme default',family:''},
    {id:'sans',label:'System sans',family:'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'},
    {id:'mono',label:'System monospace',family:'ui-monospace, "SFMono-Regular", Consolas, monospace'},
    {id:'orbitron',label:'Orbitron',family:'"Orbitron", monospace'},
    {id:'share-tech',label:'Share Tech Mono',family:'"Share Tech Mono", monospace'}
];
export const headingFontFamily = id => HEADING_FONTS.find(font => font.id === id)?.family || '';
