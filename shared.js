// ===== shared.js =====
// Helper functions and formatting utilities used across the rent-cabinet pages
// (personal cabinet, and the manager / manager_ar / manager_vsd cabinets). Load
// this before each page's own <script> block.

function rcFmt(n) { return n.toLocaleString('ru-RU') + ' \u20BD'; }
// Formats a large sum in a compact form for chart value labels, e.g. "570 000 ₽".
function rcFmtShort(n) { return rcFmt(n); }

var RM_TODAY = new Date('2026-08-12');

function rmParseDate(str) {
    var p = str.split('.');
    return new Date(p[2] + '-' + p[1] + '-' + p[0]);
}

function rmDaysUntil(dateStr) {
    var d = rmParseDate(dateStr);
    return Math.round((d - RM_TODAY) / 86400000);
}

function rmContractReminder(c) {
    if (c.status !== 'Действующий' && c.status !== 'Окончивший срок действия') return null;
    var days = rmDaysUntil(c.endDate);
    var text = 'Срок действия договора ' + c.num + ' истекает ' + c.endDate + 'г. Необходимо продлить или расторгнуть договор.';
    if (days < 0) return { level: 'red', text: 'Срок действия договора ' + c.num + ' истёк ' + c.endDate + 'г. Необходимо продлить или расторгнуть договор.' };
    if (days <= 30) return { level: 'red', text: text };
    if (days <= 60) return { level: 'yellow', text: text };
    if (days <= 90) return { level: 'green', text: text };
    return null;
}

function rcBadge(status) {
    var cls = 'rc-b-wait';
    if (status === 'Одобрена' || status === 'Действует' || status === 'Принято' || status === 'Оплачено' || status === 'Оплачен' || status === 'Действующий' || status === 'Свободно' || status === 'Выполнено') cls = 'rc-b-ok';
    if (status === 'Зарегистрировано' || status === 'К оплате' || status === 'Принять в работу') cls = 'rc-b-open';
    if (status === 'Отказано' || status === 'Расторгнут') cls = 'rc-b-reject';
    return '<span class="rc-badge ' + cls + '">' + status + '</span>';
}

function rcToggleRemindersList(listId, chevronId) {
    var list = document.getElementById(listId);
    var chevron = document.getElementById(chevronId);
    var isOpen = list.style.display !== 'none';
    list.style.display = isOpen ? 'none' : 'block';
    chevron.textContent = isOpen ? '▼ показать' : '▲ скрыть';
}

function rmDonutChartSVG(segments) {
    var size = 220, cx = 110, cy = 110, r = 78, strokeWidth = 30;
    var circumference = 2 * Math.PI * r;
    var total = segments.reduce(function(s, seg) { return s + seg.value; }, 0);
    var offset = 0;
    var arcs = total === 0 ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#E9ECEF" stroke-width="' + strokeWidth + '"/>' : segments.filter(function(s) { return s.value > 0; }).map(function(seg) {
        var frac = seg.value / total;
        var dash = frac * circumference;
        var gap = circumference - dash;
        var rotate = (offset / total) * 360 - 90;
        offset += seg.value;
        return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + seg.color + '" stroke-width="' + strokeWidth + '" stroke-dasharray="' + dash.toFixed(1) + ' ' + gap.toFixed(1) + '" transform="rotate(' + rotate.toFixed(1) + ' ' + cx + ' ' + cy + ')"><title>' + seg.label + ': ' + Math.round(frac * 100) + '%</title></circle>';
    }).join('');
    var centerText = '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" font-size="24" font-weight="800" fill="#1D1D1F" font-family="Inter,sans-serif">' + total + '</text>' +
        '<text x="' + cx + '" y="' + (cy + 17) + '" text-anchor="middle" font-size="11" fill="#8E8E93" font-family="Inter,sans-serif">всего</text>';
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="220" height="220">' + arcs + centerText + '</svg>';
}

function rmBarChartCountsSVG(values, labels, colors) {
    var w = 400, h = 220, padL = 34, padR = 16, padT = 30, padB = 34;
    var maxV = Math.max.apply(null, values) * 1.3 || 1;
    var innerW = w - padL - padR, innerH = h - padT - padB;
    var n = values.length;
    var slot = innerW / n;
    var barW = Math.min(slot * 0.5, 60);
    var s = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" style="max-width:420px">';
    values.forEach(function(v, i) {
        var cx = padL + slot * i + slot / 2;
        var barH = (innerH * v) / maxV;
        var y = padT + innerH - barH;
        var x = cx - barW / 2;
        s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + Math.max(barH, 0).toFixed(1) + '" rx="6" fill="' + colors[i] + '"><title>' + labels[i] + ': ' + v + '</title></rect>';
        s += '<text x="' + cx.toFixed(1) + '" y="' + (y - 8).toFixed(1) + '" text-anchor="middle" font-size="13" font-weight="700" fill="#1D1D1F" font-family="Inter,sans-serif">' + v + '</text>';
        s += '<text x="' + cx.toFixed(1) + '" y="' + (h - 12).toFixed(1) + '" text-anchor="middle" font-size="10.5" fill="#6C757D" font-family="Inter,sans-serif">' + labels[i] + '</text>';
    });
    s += '</svg>';
    return s;
}


// ===== Lightweight client-side persistence ("database" layer for this static prototype) =====
// This prototype has no backend server, so each browser keeps its own local copy of
// state via localStorage, namespaced by key. Practically this means:
//  - changes (status updates, kanban drag-and-drop, etc.) survive page reloads and
//    closing the tab, for that same person's browser;
//  - it does NOT sync between different people/devices — real shared multi-user data
//    would need an actual backend (e.g. Supabase/Firebase) sitting behind this UI.
var rcDB = {
    save: function(key, value) {
        try { localStorage.setItem('pulse:' + key, JSON.stringify(value)); } catch (e) { console.warn('rcDB.save failed for ' + key, e); }
    },
    load: function(key, fallback) {
        try {
            var raw = localStorage.getItem('pulse:' + key);
            return raw !== null ? JSON.parse(raw) : fallback;
        } catch (e) { return fallback; }
    },
    clear: function(key) {
        try { localStorage.removeItem('pulse:' + key); } catch (e) {}
    }
};
