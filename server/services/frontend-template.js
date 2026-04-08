// frontend-template.js — macOS-inspired CSS template injected into every generated frontend

export const TEMPLATE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── macOS Light theme (default) ─────────────────────────────────────────── */
:root {
  --bg:        #f2f2f7;
  --surface:   #ffffff;
  --surface2:  #f9f9fb;
  --border:    rgba(0,0,0,0.10);
  --border-strong: rgba(0,0,0,0.18);
  --text:      #1c1c1e;
  --text2:     #3a3a3c;
  --muted:     #8e8e93;
  --accent:    #0071e3;
  --accent-hover: #0077ed;
  --red:       #ff3b30;
  --green:     #34c759;
  --amber:     #ff9f0a;
  --blue:      #007aff;
  --purple:    #af52de;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
  --shadow:    0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08);
  --radius:    8px;
  --radius-lg: 12px;
  --font:      -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  --font-display: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  --transition: .18s ease;
}

/* ── macOS Dark theme ─────────────────────────────────────────────────────── */
[data-theme="dark"] {
  --bg:        #1c1c1e;
  --surface:   #2c2c2e;
  --surface2:  #3a3a3c;
  --border:    rgba(255,255,255,0.10);
  --border-strong: rgba(255,255,255,0.18);
  --text:      #f2f2f7;
  --text2:     #ebebf0;
  --muted:     #8e8e93;
  --accent:    #0a84ff;
  --accent-hover: #409cff;
  --red:       #ff453a;
  --green:     #30d158;
  --amber:     #ffd60a;
  --blue:      #0a84ff;
  --purple:    #bf5af2;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --shadow:    0 4px 16px rgba(0,0,0,0.4);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.55);
}

/* ── Base ─────────────────────────────────────────────────────────────────── */
body { font-family: var(--font); background: var(--bg); color: var(--text); font-size: 14px; line-height: 1.5; min-height: 100vh; display: flex; flex-direction: column; -webkit-font-smoothing: antialiased; }

/* ── Titlebar ─────────────────────────────────────────────────────────────── */
.mac-titlebar { height: 52px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 16px; gap: 12px; flex-shrink: 0; position: sticky; top: 0; z-index: 10; }
.mac-traffic { display: flex; gap: 7px; flex-shrink: 0; }
.mac-dot { width: 12px; height: 12px; border-radius: 50%; opacity: 0.85; }
.mac-dot-red { background: var(--red); }
.mac-dot-amber { background: var(--amber); }
.mac-dot-green { background: var(--green); }
.mac-title { flex: 1; font-size: 14px; font-weight: 600; color: var(--text); text-align: center; letter-spacing: -0.2px; }
.mac-titlebar-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* ── Layout ───────────────────────────────────────────────────────────────── */
.mac-layout { display: flex; flex: 1; min-height: 0; overflow: hidden; }

/* ── Sidebar ──────────────────────────────────────────────────────────────── */
.mac-sidebar { width: 220px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; overflow-y: auto; padding: 10px 0; }
.mac-sidebar-section { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: var(--muted); padding: 14px 16px 4px; }
.mac-sidebar-item { display: flex; align-items: center; gap: 9px; padding: 7px 16px; color: var(--text2); font-size: 13px; font-weight: 500; cursor: pointer; border: none; background: none; width: 100%; text-align: left; text-decoration: none; transition: background var(--transition), color var(--transition); }
.mac-sidebar-item:hover { background: var(--surface2); color: var(--text); }
.mac-sidebar-item.active { background: var(--accent); color: #fff; border-radius: 7px; margin: 0 8px; width: calc(100% - 16px); padding: 7px 10px; }
.mac-sidebar-divider { border: none; border-top: 1px solid var(--border); margin: 6px 16px; }

/* ── Main ─────────────────────────────────────────────────────────────────── */
.mac-main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; background: var(--bg); }
.mac-toolbar { padding: 12px 20px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
.mac-toolbar-title { font-size: 17px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; flex: 1; }
.mac-content { flex: 1; padding: 20px; overflow-y: auto; }
.mac-content::-webkit-scrollbar { width: 6px; }
.mac-content::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }

/* ── Buttons ──────────────────────────────────────────────────────────────── */
.mac-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: var(--radius); border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: 13px; font-family: var(--font); font-weight: 500; cursor: pointer; transition: background var(--transition), box-shadow var(--transition); white-space: nowrap; box-shadow: var(--shadow-sm); }
.mac-btn:hover:not(:disabled) { background: var(--surface2); box-shadow: var(--shadow); }
.mac-btn:active:not(:disabled) { transform: scale(0.98); }
.mac-btn:disabled { opacity: .4; cursor: default; }
.mac-btn-primary { background: var(--accent); border-color: transparent; color: #fff; box-shadow: 0 1px 3px rgba(0,113,227,0.3); }
.mac-btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.mac-btn-danger { border-color: var(--red); color: var(--red); }
.mac-btn-danger:hover:not(:disabled) { background: rgba(255,59,48,.08); }
.mac-btn-sm { padding: 4px 10px; font-size: 12px; }

/* ── Inputs ───────────────────────────────────────────────────────────────── */
.mac-input-group { display: flex; flex-direction: column; gap: 5px; }
.mac-label { font-size: 12px; font-weight: 600; color: var(--muted); }
.mac-input { padding: 8px 12px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius); color: var(--text); font-size: 14px; font-family: var(--font); outline: none; transition: border-color var(--transition), box-shadow var(--transition); width: 100%; }
.mac-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(0,113,227,0.18); }
.mac-input::placeholder { color: var(--muted); }
textarea.mac-input { resize: vertical; min-height: 80px; }

/* ── Cards ────────────────────────────────────────────────────────────────── */
.mac-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
.mac-card-header { padding: 13px 16px; border-bottom: 1px solid var(--border); font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 10px; }
.mac-card-body { padding: 16px; }
.mac-card-footer { padding: 11px 16px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; background: var(--surface2); }

/* ── List ─────────────────────────────────────────────────────────────────── */
.mac-list { display: flex; flex-direction: column; }
.mac-list-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--border); transition: background var(--transition); }
.mac-list-item:last-child { border-bottom: none; }
.mac-list-item:hover { background: var(--surface2); }
.mac-list-item-title { font-weight: 500; font-size: 14px; color: var(--text); }
.mac-list-item-sub { font-size: 12px; color: var(--muted); margin-top: 1px; }
.mac-list-item-meta { margin-left: auto; font-size: 12px; color: var(--muted); flex-shrink: 0; }

/* ── Table ────────────────────────────────────────────────────────────────── */
.mac-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.mac-table th { padding: 9px 14px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); border-bottom: 1px solid var(--border); background: var(--surface2); }
.mac-table td { padding: 11px 14px; border-bottom: 1px solid var(--border); color: var(--text); }
.mac-table tr:last-child td { border-bottom: none; }
.mac-table tbody tr:hover td { background: var(--surface2); }

/* ── Badges ───────────────────────────────────────────────────────────────── */
.mac-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.mac-badge-blue { background: rgba(0,122,255,.12); color: var(--blue); }
.mac-badge-green { background: rgba(52,199,89,.12); color: var(--green); }
.mac-badge-red { background: rgba(255,59,48,.12); color: var(--red); }
.mac-badge-amber { background: rgba(255,159,10,.12); color: var(--amber); }

/* ── Modal ────────────────────────────────────────────────────────────────── */
.mac-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 24px; }
.mac-modal { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); width: 100%; max-width: 520px; max-height: 88vh; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); animation: mac-in .18s ease; }
@keyframes mac-in { from { opacity:0; transform:scale(.97) translateY(4px); } to { opacity:1; transform:none; } }
.mac-modal-header { padding: 15px 18px; border-bottom: 1px solid var(--border); font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: space-between; }
.mac-modal-body { padding: 18px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.mac-modal-footer { padding: 12px 18px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; background: var(--surface2); flex-shrink: 0; }

/* ── Empty / Spinner / Toast ──────────────────────────────────────────────── */
.mac-empty { text-align: center; padding: 52px 24px; }
.mac-empty-icon { font-size: 40px; display: block; margin-bottom: 12px; opacity: 0.4; }
.mac-empty-title { font-size: 17px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.mac-empty-sub { font-size: 13px; color: var(--muted); }
.mac-spinner { width: 24px; height: 24px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .7s linear infinite; margin: 40px auto; }
@keyframes spin { to { transform: rotate(360deg); } }
.mac-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(12px); background: var(--surface2); border: 1px solid var(--border); color: var(--text); padding: 9px 18px; border-radius: 20px; box-shadow: var(--shadow); z-index: 200; font-size: 13px; font-weight: 500; opacity: 0; transition: opacity .2s, transform .2s; pointer-events: none; white-space: nowrap; }
.mac-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

/* ── Theme toggle ─────────────────────────────────────────────────────────── */
.mac-theme-btn { width: 32px; height: 20px; border-radius: 10px; background: var(--muted); border: none; cursor: pointer; position: relative; transition: background var(--transition); flex-shrink: 0; }
[data-theme="dark"] .mac-theme-btn { background: var(--accent); }
.mac-theme-btn::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform var(--transition); }
[data-theme="dark"] .mac-theme-btn::after { transform: translateX(12px); }

/* ── Utilities ────────────────────────────────────────────────────────────── */
.mac-divider { border: none; border-top: 1px solid var(--border); margin: 12px 0; }
.mac-flex { display: flex; align-items: center; gap: 8px; }
.mac-between { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mac-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.mac-text-muted { color: var(--muted); }
.mac-text-accent { color: var(--accent); }
.mac-text-danger { color: var(--red); }
.mac-mt-8 { margin-top: 8px; }
.mac-mt-16 { margin-top: 16px; }
@media (max-width: 700px) {
  .mac-sidebar { display: none; }
  .mac-grid-2 { grid-template-columns: 1fr; }
  .mac-content { padding: 14px; }
}
`.trim();

export const THEME_TOGGLE_JS = `
function toggleTheme() {
  document.documentElement.dataset.theme =
    document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
}
`.trim();

// ── CadenzaUI component library ───────────────────────────────────────────────
// Self-contained IIFE injected into every generated frontend HTML at write time.
// Provides window.CadenzaUI with pre-built components so LLMs only write logic.
export const UI_LIB_JS = `(function(w){'use strict';
const css=${JSON.stringify(TEMPLATE_CSS)};
const $=(s,c=document)=>c.querySelector(s);
function mk(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
let _content=null,_overlay=null,_toastEl=null,_toastTimer=null;
const UI=w.CadenzaUI={
  init(title='App'){
    const s=mk('style');s.textContent=css;document.head.appendChild(s);
    document.body.style.margin='0';
    const tb=mk('div','mac-titlebar');
    tb.innerHTML='<div class="mac-title" id="_title"></div><div class="mac-titlebar-actions"><button class="mac-theme-btn" id="_theme-btn"></button></div>';
    tb.querySelector('#_title').textContent=title;
    tb.querySelector('#_theme-btn').addEventListener('click',()=>UI.toggleTheme());
    const layout=mk('div','mac-layout');
    const sidebar=mk('nav','mac-sidebar');sidebar.id='_sidebar';
    const main=mk('div','mac-main');
    const toolbar=mk('div','mac-toolbar');toolbar.id='_toolbar';
    _content=mk('div','mac-content');_content.id='_content';
    main.appendChild(toolbar);main.appendChild(_content);
    layout.appendChild(sidebar);layout.appendChild(main);
    document.body.appendChild(tb);document.body.appendChild(layout);
    _overlay=mk('div','mac-overlay');_overlay.style.display='none';_overlay.id='_overlay';
    const modal=mk('div','mac-modal');modal.id='_modal';
    _overlay.appendChild(modal);
    _overlay.addEventListener('click',e=>{if(e.target===_overlay)UI.hideForm();});
    document.body.appendChild(_overlay);
    _toastEl=mk('div','mac-toast');document.body.appendChild(_toastEl);
    return UI;
  },
  setNav(items,onSelect){
    const sb=$('#_sidebar');if(!sb)return;sb.innerHTML='';
    items.forEach((item,i)=>{
      const btn=mk('button','mac-sidebar-item'+(i===0?' active':''));
      btn.textContent=(item.icon||'')+' '+item.label;
      btn.addEventListener('click',()=>{
        [...sb.querySelectorAll('.mac-sidebar-item')].forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');onSelect(item,i);
      });
      sb.appendChild(btn);
    });
  },
  addToolbarButton(label,onClick,opts={}){
    const tb=$('#_toolbar');if(!tb)return;
    const btn=mk('button','mac-btn'+(opts.primary?' mac-btn-primary':'')+(opts.danger?' mac-btn-danger':''));
    btn.textContent=label;btn.addEventListener('click',onClick);tb.appendChild(btn);return btn;
  },
  setToolbarTitle(title){
    const tb=$('#_toolbar');if(!tb)return;
    let t=$('#_toolbar-title');
    if(!t){t=mk('span','mac-toolbar-title');t.id='_toolbar-title';tb.prepend(t);}
    t.textContent=title;
  },
  renderSearch(container,opts={}){
    const target=typeof container==='string'?($(container)||$('#_toolbar')):container;
    if(!target)return;
    const{placeholder='Search...',onSearch}=opts;
    const wrap=mk('div','mac-flex');wrap.style.flex='1';
    const inp=mk('input','mac-input');
    inp.type='text';inp.placeholder=placeholder;inp.style.cssText='max-width:280px;flex:1;';
    let db;inp.addEventListener('input',()=>{clearTimeout(db);db=setTimeout(()=>onSearch&&onSearch(inp.value),280);});
    wrap.appendChild(inp);target.appendChild(wrap);return inp;
  },
  renderList(container,opts={}){
    const target=typeof container==='string'?($(container)||_content):container||_content;
    if(!target)return;
    const{data=[],columns=[],onEdit,onDelete}=opts;
    target.innerHTML='';
    if(!data.length){
      target.appendChild(mk('div','mac-empty','<span class="mac-empty-icon">📭</span><div class="mac-empty-title">No records yet</div><div class="mac-empty-sub">Use the Add button to create one</div>'));
      return;
    }
    const wrap=mk('div','mac-card');
    const table=mk('table','mac-table');
    const thead=mk('thead');const hr=mk('tr');
    columns.forEach(c=>{const th=mk('th');th.textContent=c.label||c.key;hr.appendChild(th);});
    const ath=mk('th');ath.textContent='Actions';hr.appendChild(ath);
    thead.appendChild(hr);table.appendChild(thead);
    const tbody=mk('tbody');
    data.forEach(item=>{
      const tr=mk('tr');
      columns.forEach(c=>{const td=mk('td');td.textContent=item[c.key]??'';tr.appendChild(td);});
      const atd=mk('td');atd.style.whiteSpace='nowrap';
      if(onEdit){const eb=mk('button','mac-btn mac-btn-sm','Edit');eb.addEventListener('click',()=>onEdit(item));atd.appendChild(eb);}
      if(onDelete){const db=mk('button','mac-btn mac-btn-danger mac-btn-sm','Delete');db.style.marginLeft='6px';db.addEventListener('click',()=>{if(confirm('Delete this record?'))onDelete(item);});atd.appendChild(db);}
      tr.appendChild(atd);tbody.appendChild(tr);
    });
    table.appendChild(tbody);wrap.appendChild(table);target.appendChild(wrap);
  },
  renderForm(opts={}){
    const{title='Form',fields=[],values={},onSubmit,onCancel}=opts;
    const modal=$('#_modal');if(!modal)return;
    let html='<div class="mac-modal-header"><span>'+title+'</span></div><div class="mac-modal-body">';
    fields.forEach(f=>{
      const t=f.type||'text';
      const v=(values[f.key]!=null?String(values[f.key]):'').replace(/"/g,'&quot;');
      html+='<div class="mac-input-group"><label class="mac-label" for="mf-'+f.key+'">'+(f.label||f.key)+(f.required?' *':'')+'</label>';
      if(t==='textarea')html+='<textarea class="mac-input" id="mf-'+f.key+'" name="'+f.key+'" rows="3" placeholder="'+(f.placeholder||'')+'">'+v+'</textarea>';
      else html+='<input class="mac-input" id="mf-'+f.key+'" name="'+f.key+'" type="'+t+'" value="'+v+'" placeholder="'+(f.placeholder||'')+(f.required?'" required':'"')+'>';
      html+='</div>';
    });
    html+='</div><div class="mac-modal-footer"><button class="mac-btn" id="_mf-cancel">Cancel</button><button class="mac-btn mac-btn-primary" id="_mf-submit">Save</button></div>';
    modal.innerHTML=html;
    _overlay.style.display='flex';
    $('#_mf-cancel',modal).addEventListener('click',()=>{UI.hideForm();if(onCancel)onCancel();});
    $('#_mf-submit',modal).addEventListener('click',()=>{
      const data={};
      fields.forEach(f=>{const el=document.getElementById('mf-'+f.key);if(el)data[f.key]=el.value;});
      if(onSubmit)onSubmit(data);
    });
    setTimeout(()=>{const fi=modal.querySelector('input,textarea,select');if(fi)fi.focus();},50);
  },
  hideForm(){
    if(_overlay)_overlay.style.display='none';
    const m=$('#_modal');if(m)m.innerHTML='';
  },
  showToast(msg,type='success'){
    if(!_toastEl)return;
    _toastEl.textContent=msg;
    _toastEl.className='mac-toast show';
    _toastEl.style.cssText=type==='error'?'background:rgba(255,59,48,.12);color:var(--red);':'';
    clearTimeout(_toastTimer);
    _toastTimer=setTimeout(()=>_toastEl.classList.remove('show'),3000);
  },
  toggleTheme(){const h=document.documentElement;h.dataset.theme=h.dataset.theme==='dark'?'light':'dark';},
  getContent(){return _content||$('#_content');},
  getToolbar(){return $('#_toolbar');}
};
})(window);`;

export const CLASS_GUIDE = `
macOS-style Template — use ONLY these classes (no custom CSS, no inline styles):

CHROME
  <html data-theme="light">   (default light; toggleTheme() switches to "dark")
  .mac-titlebar               sticky top bar
    .mac-traffic              traffic-light dots row
      .mac-dot .mac-dot-red / .mac-dot-amber / .mac-dot-green
    .mac-title                centered window title
    .mac-titlebar-actions     right-side controls
  .mac-theme-btn              pill toggle — onclick="toggleTheme()"

LAYOUT
  .mac-layout                 flex row filling viewport below titlebar
    .mac-sidebar              left sidebar (220px)
      .mac-sidebar-section    uppercase section label
      .mac-sidebar-item [.active]
      .mac-sidebar-divider
    .mac-main                 flex column, fills rest
      .mac-toolbar            sub-header row
        .mac-toolbar-title    page title
      .mac-content            scrollable body

COMPONENTS
  .mac-btn / .mac-btn-primary / .mac-btn-danger / .mac-btn-sm
  .mac-card / .mac-card-header / .mac-card-body / .mac-card-footer
  .mac-input-group / .mac-label / .mac-input  (apply .mac-input to input/textarea/select)
  .mac-list > .mac-list-item (.mac-list-item-title / .mac-list-item-sub / .mac-list-item-meta)
  .mac-table > th / td
  .mac-badge .mac-badge-blue / -green / -red / -amber
  .mac-overlay > .mac-modal > .mac-modal-header / .mac-modal-body / .mac-modal-footer
  .mac-empty / .mac-empty-icon / .mac-empty-title / .mac-empty-sub
  .mac-spinner
  .mac-toast [.show]

UTILITIES
  .mac-flex / .mac-between / .mac-grid-2
  .mac-divider / .mac-text-muted / .mac-text-accent / .mac-text-danger
  .mac-mt-8 / .mac-mt-16
`.trim();
