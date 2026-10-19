export const POSTER_FORMATS = Object.freeze({ portrait: { width: 1800, height: 2400 }, square: { width: 2000, height: 2000 }, landscape: { width: 2560, height: 1600 } });
const names = { liquid: '液态银', orbit: '轨道回声', crystal: '晶化记忆', silver: '银色', lime: '酸橙', ink: '墨色' };
export function renderCorePoster(scene, snapshot, format = 'portrait', showTitle = true, preview = false) {
  const target = POSTER_FORMATS[format];
  const scale = preview ? Math.min(1, 950 / Math.max(target.width, target.height)) : 1;
  const canvas = document.createElement('canvas'); canvas.width = Math.round(target.width * scale); canvas.height = Math.round(target.height * scale);
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('浏览器无法创建海报画布。');
  ctx.scale(scale, scale);
  const { width: w, height: h } = target, margin = Math.round(w * .046);
  ctx.fillStyle = '#f7f8f5'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#101114'; ctx.font = `${Math.round(w * .016)}px ArchiveMono, ArchiveSans, monospace`;
  ctx.fillText('RECORDER LAB / MEMORY CORE', margin, margin + 24);
  ctx.textAlign = 'right'; ctx.fillText(String(snapshot.seed).padStart(4, '0'), w - margin, margin + 24); ctx.textAlign = 'left';
  const top = margin + 83, footer = showTitle ? (format === 'portrait' ? 430 : format === 'square' ? 280 : 220) : 86;
  const artWidth = w - margin * 2, artHeight = h - top - footer - margin;
  scene.setView(snapshot.view); scene.setPhase(snapshot.phase);
  const image = scene.capture(Math.round(artWidth * scale), Math.round(artHeight * scale));
  ctx.drawImage(image, margin, top, artWidth, artHeight);
  if (showTitle) {
    const baseline = top + artHeight + (format === 'portrait' ? 160 : 114);
    let size = format === 'portrait' ? 126 : format === 'square' ? 104 : 94;
    do { ctx.font = `oblique 8deg 400 ${size}px ArchiveCard, ArchiveSans, sans-serif`; if (ctx.measureText(snapshot.title).width <= artWidth) break; size -= 4; } while (size > 32);
    ctx.fillStyle = '#101114'; ctx.fillText(snapshot.title, margin, baseline);
    const metaY = h - margin - (format === 'portrait' ? 100 : 57);
    ctx.font = `${Math.round(w * .014)}px ArchiveMono, ArchiveSans, monospace`; ctx.fillStyle = '#5f686b';
    ctx.fillText(`${names[snapshot.preset]} / ${names[snapshot.palette]}     ${snapshot.deform.toFixed(2)} · ${snapshot.metal.toFixed(2)} · ${snapshot.glow.toFixed(2)}`, margin, metaY);
    ctx.fillStyle = '#cce95f'; ctx.beginPath(); ctx.moveTo(w - margin - 65, metaY - 22); ctx.lineTo(w - margin - 40, metaY - 22); ctx.lineTo(w - margin - 55, metaY + 12); ctx.lineTo(w - margin - 80, metaY + 12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w - margin - 30, metaY - 22); ctx.lineTo(w - margin - 5, metaY - 22); ctx.lineTo(w - margin - 20, metaY + 12); ctx.lineTo(w - margin - 45, metaY + 12); ctx.fill();
  }
  ctx.strokeStyle = '#c5ccca'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(margin, h - margin - 24); ctx.lineTo(w - margin, h - margin - 24); ctx.stroke();
  ctx.font = `${Math.round(w * .0115)}px ArchiveMono, ArchiveSans, monospace`; ctx.fillStyle = '#737d80'; ctx.fillText('记忆核心 / 记录者实验室', margin, h - margin + 10);
  return canvas;
}
export function canvasPNG(canvas) { return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('海报生成失败，请重试。')), 'image/png')); }
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
