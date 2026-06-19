// ==================== THÈMES ====================
function applyCustomTheme(themeData = null) {
    const root = document.documentElement;
    const data = themeData || JSON.parse(localStorage.getItem('fl_custom_theme') || '{}');
    if (data.bgColor) { document.body.style.background = data.bgColor; root.style.setProperty('--custom-bg', data.bgColor); }
    if (data.cardBgColor) { root.style.setProperty('--custom-card-bg', data.cardBgColor); }
    if (data.textColor) { root.style.setProperty('--custom-text', data.textColor); }
    if (data.btnBgColor) { root.style.setProperty('--custom-btn-bg', data.btnBgColor); }
    if (data.inputBgColor) { root.style.setProperty('--custom-input-bg', data.inputBgColor); }
    if (data.borderColor) { root.style.setProperty('--custom-border', data.borderColor); }
    if (data.focusColor) { root.style.setProperty('--custom-focus', data.focusColor); }
    if (data.bgImage) { document.body.style.backgroundImage = `url(${data.bgImage})`; document.body.style.backgroundSize = 'cover'; document.body.style.backgroundAttachment = 'fixed'; }
    else { document.body.style.backgroundImage = ''; document.body.style.backgroundSize = ''; document.body.style.backgroundAttachment = ''; }
    root.style.setProperty('--custom-donate-bg', data.cardBgColor || '#f4f6fa');
    root.style.setProperty('--custom-tab-bg', data.cardBgColor ? data.cardBgColor + 'dd' : '#e8ecf1');
    root.style.setProperty('--custom-btn-text', data.textColor || '#000');
    root.style.setProperty('--custom-btn-hover', data.btnBgColor || '#cbd5e1');
}

function loadCustomTheme() {
    const saved = localStorage.getItem('fl_custom_theme');
    if (saved) {
        const data = JSON.parse(saved);
        document.getElementById('bgColor').value = data.bgColor || '#eef2f5';
        document.getElementById('cardBgColor').value = data.cardBgColor || '#ffffff';
        document.getElementById('textColor').value = data.textColor || '#1e2a3a';
        document.getElementById('btnBgColor').value = data.btnBgColor || '#e2e8f0';
        document.getElementById('inputBgColor').value = data.inputBgColor || '#ffffff';
        document.getElementById('borderColor').value = data.borderColor || '#cfdde6';
        document.getElementById('focusColor').value = data.focusColor || '#8ba0b5';
        return data;
    }
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.theme === 'custom') {
                const panel = document.getElementById('colorPickerPanel');
                panel.classList.toggle('show');
                return;
            }
            document.getElementById('colorPickerPanel').classList.remove('show');
            document.body.className = 'theme-' + btn.dataset.theme;
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            localStorage.setItem('fl_theme', btn.dataset.theme);
            document.body.style.backgroundImage = '';
            document.body.style.backgroundSize = '';
            document.body.style.backgroundAttachment = '';
        });
    });

    document.getElementById('applyCustomBtn').addEventListener('click', () => {
        const data = {
            bgColor: document.getElementById('bgColor').value,
            cardBgColor: document.getElementById('cardBgColor').value,
            textColor: document.getElementById('textColor').value,
            btnBgColor: document.getElementById('btnBgColor').value,
            inputBgColor: document.getElementById('inputBgColor').value,
            borderColor: document.getElementById('borderColor').value,
            focusColor: document.getElementById('focusColor').value,
            bgImage: localStorage.getItem('fl_bg_image') || null
        };
        localStorage.setItem('fl_custom_theme', JSON.stringify(data));
        document.body.className = 'theme-custom';
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('customThemeBtn').classList.add('active');
        localStorage.setItem('fl_theme', 'custom');
        applyCustomTheme(data);
        document.getElementById('colorPickerPanel').classList.remove('show');
    });

    document.getElementById('bgImageFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            localStorage.setItem('fl_bg_image', ev.target.result);
            document.body.style.backgroundImage = `url(${ev.target.result})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundAttachment = 'fixed';
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('resetBgImageBtn').addEventListener('click', () => {
        localStorage.removeItem('fl_bg_image');
        document.body.style.backgroundImage = '';
        document.body.style.backgroundSize = '';
        document.body.style.backgroundAttachment = '';
    });

    const savedTheme = localStorage.getItem('fl_theme') || 'light';
    if (savedTheme === 'custom') {
        const customData = loadCustomTheme();
        document.body.className = 'theme-custom';
        document.querySelectorAll('.theme-btn').forEach(b => { b.classList.remove('active'); if (b.dataset.theme === 'custom') b.classList.add('active'); });
        if (customData) applyCustomTheme(customData);
    } else {
        document.body.className = 'theme-' + savedTheme;
        document.querySelectorAll('.theme-btn').forEach(b => { b.classList.remove('active'); if (b.dataset.theme === savedTheme) b.classList.add('active'); });
    }
    const savedBgImage = localStorage.getItem('fl_bg_image');
    if (savedBgImage && savedTheme === 'custom') {
        document.body.style.backgroundImage = `url(${savedBgImage})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundAttachment = 'fixed';
    }
    loadCustomTheme();
});