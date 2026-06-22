const DATA_URL = './data/study-data.json';
const LS_KEY = 'nihongo-memory-coach-v1';

const app = {
  cards: [],
  view: 'dashboard',
  filters: { level: 'all', kind: 'all', q: '' },
  page: 1,
  pageSize: 40,
  currentStudy: null,
  quiz: null,
  drive: { active:false, list:[], index:0, paused:false },
  state: loadState()
};

function loadState(){
  try{
    return JSON.parse(localStorage.getItem(LS_KEY)) || defaultState();
  }catch(e){ return defaultState(); }
}
function defaultState(){
  return {
    version: 1,
    settings: { newPerDay: 30, driveDelay: 1200, showRaw: true },
    progress: {},
    notes: {},
    history: [],
    createdAt: new Date().toISOString(),
    theme: 'light'
  };
}
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(app.state)); }
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function esc(s=''){ return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function fmtDate(ts){ if(!ts) return 'Chưa học'; return new Date(ts).toLocaleString('vi-VN'); }
function now(){ return Date.now(); }
function days(n){ return n*24*60*60*1000; }
function minutes(n){ return n*60*1000; }

async function init(){
  document.documentElement.dataset.theme = app.state.theme || 'light';
  bindShell();
  try{
    const res = await fetch(DATA_URL, {cache:'no-store'});
    const json = await res.json();
    app.cards = (json.cards || []).map(c => ({...c, searchText: makeSearchText(c)}));
    render();
  }catch(err){
    $('#view').innerHTML = `<div class="panel"><h2>Không tải được dữ liệu</h2><p class="muted">Hãy chạy app trên GitHub Pages hoặc một server tĩnh. Nếu mở trực tiếp file index.html, trình duyệt có thể chặn fetch JSON.</p><pre>${esc(err.message)}</pre></div>`;
  }
}
function makeSearchText(c){ return [c.title,c.reading,c.hanviet,c.meaning_vi,c.raw,c.level,c.kind,c.source,c.lesson].join(' ').toLowerCase(); }
function bindShell(){
  $all('.nav').forEach(btn => btn.addEventListener('click', () => {
    app.view = btn.dataset.view;
    app.page = 1;
    $all('.nav').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    stopDrive();
    render();
  }));
  $('#levelFilter').addEventListener('change', e=>{ app.filters.level=e.target.value; app.page=1; render(); });
  $('#kindFilter').addEventListener('change', e=>{ app.filters.kind=e.target.value; app.page=1; render(); });
  $('#searchBox').addEventListener('input', e=>{ app.filters.q=e.target.value.trim().toLowerCase(); app.page=1; render(); });
  $('#themeBtn').addEventListener('click', () => {
    app.state.theme = (app.state.theme === 'dark') ? 'light' : 'dark';
    document.documentElement.dataset.theme = app.state.theme;
    saveState();
  });
  $('#exportBtn').addEventListener('click', exportProgress);
}

function filteredCards(){
  return app.cards.filter(c => {
    if(app.filters.level !== 'all' && c.level !== app.filters.level) return false;
    if(app.filters.kind !== 'all' && c.kind !== app.filters.kind) return false;
    if(app.filters.q && !c.searchText.includes(app.filters.q)) return false;
    return true;
  });
}
function getP(card){ return app.state.progress[card.id] || {}; }
function isLearned(card){ return !!getP(card).lastReviewedAt; }
function isDue(card){ const p = getP(card); return p.lastReviewedAt && (!p.dueAt || p.dueAt <= now()); }
function isNew(card){ return !getP(card).lastReviewedAt; }
function countStats(cards=app.cards){
  const total=cards.length, learned=cards.filter(isLearned).length, due=cards.filter(isDue).length, fresh=cards.filter(isNew).length;
  const weak=cards.filter(c => (getP(c).wrong||0) >= 2).length;
  return {total, learned, due, fresh, weak};
}

function render(){
  const views = {dashboard:renderDashboard, study:renderStudy, quiz:renderQuiz, drive:renderDrive, library:renderLibrary, mistakes:renderMistakes, settings:renderSettings};
  (views[app.view] || renderDashboard)();
}

function renderDashboard(){
  const all=countStats(app.cards), f=countStats(filteredCards());
  const due=filteredCards().filter(isDue).slice(0,8);
  const nextNew=filteredCards().filter(isNew).slice(0,8);
  $('#view').innerHTML = `
    <section class="panel">
      <h2>Hôm nay nên học gì?</h2>
      <p class="muted">Nguyên tắc: review trước, học mới sau. Dữ liệu đang lọc: <b>${f.total}</b> thẻ.</p>
      <div class="grid stats">
        ${stat('Tổng thẻ', all.total)}
        ${stat('Đã học', all.learned)}
        ${stat('Đến hạn ôn', all.due)}
        ${stat('Từ yếu', all.weak)}
      </div>
      <div class="toolbar">
        <button class="primary" id="startReview">Review ngay (${f.due})</button>
        <button id="startNew">Học mới ${app.state.settings.newPerDay} thẻ</button>
        <button id="goDrive">Mở Drive Mode</button>
      </div>
    </section>
    <div class="grid two-col">
      <section class="panel"><h2>Đến hạn ôn</h2>${miniList(due)}</section>
      <section class="panel"><h2>Thẻ mới gợi ý</h2>${miniList(nextNew)}</section>
    </div>
  `;
  $('#startReview').onclick=()=>{ app.view='study'; activateNav('study'); startStudy('review'); };
  $('#startNew').onclick=()=>{ app.view='study'; activateNav('study'); startStudy('new'); };
  $('#goDrive').onclick=()=>{ app.view='drive'; activateNav('drive'); renderDrive(); };
}
function stat(label,num){ return `<div class="stat"><div class="num">${num}</div><div class="label">${label}</div></div>`; }
function miniList(cards){
  if(!cards.length) return `<p class="muted">Không có thẻ trong mục này.</p>`;
  return `<div>${cards.map(c=>`<div class="pill" title="${esc(c.source)}">${esc(c.level)} · ${c.kind==='kanji'?'Kanji':'Từ'} · <b>${esc(c.title)}</b> ${esc(c.reading||c.hanviet||'')}</div>`).join(' ')}</div>`;
}
function activateNav(view){ $all('.nav').forEach(b=>b.classList.toggle('active', b.dataset.view===view)); }

function renderStudy(){
  $('#view').innerHTML = `
    <section class="panel">
      <h2>Học / Review</h2>
      <div class="toolbar">
        <button id="modeReview" class="primary">Review đến hạn</button>
        <button id="modeNew">Học thẻ mới</button>
        <button id="modeAll">Luyện tất cả thẻ lọc</button>
      </div>
      <div id="studyArea"></div>
    </section>`;
  $('#modeReview').onclick=()=>startStudy('review');
  $('#modeNew').onclick=()=>startStudy('new');
  $('#modeAll').onclick=()=>startStudy('all');
  startStudy(app.currentStudy?.mode || 'review');
}
function startStudy(mode){
  if(mode === 'single' && app.currentStudy?.deck?.length){ renderStudyCard(); return; }
  let deck = filteredCards();
  if(mode==='review') deck = deck.filter(isDue);
  if(mode==='new') deck = deck.filter(isNew).slice(0, app.state.settings.newPerDay || 30);
  if(mode==='all') deck = shuffle(deck).slice(0, 100);
  app.currentStudy = { mode, deck, index:0, revealed:false };
  renderStudyCard();
}
function renderStudyCard(){
  const area=$('#studyArea');
  const s=app.currentStudy;
  if(!s || !s.deck.length){
    area.innerHTML = `<div class="warning">Không có thẻ phù hợp. Hãy đổi bộ lọc hoặc chọn học tất cả.</div>`;
    return;
  }
  const card=s.deck[s.index];
  const p=getP(card);
  area.innerHTML = `
    <div class="toolbar"><span class="pill">${s.index+1}/${s.deck.length}</span><span class="pill">Mode: ${esc(s.mode)}</span><span class="pill">Lần học: ${p.reviewCount||0}</span><span class="pill">Due: ${fmtDate(p.dueAt)}</span></div>
    ${studyCardHtml(card)}
  `;
  $('.reveal', area).onclick=()=>{ $('.back', area).classList.remove('hidden'); $('.rating', area).classList.remove('hidden'); $('.reveal', area).classList.add('hidden'); };
  $all('[data-rate]', area).forEach(btn=>btn.onclick=()=>rateCard(card, btn.dataset.rate));
}
function studyCardHtml(c){
  return `<article class="study-card">
    <div class="card-meta">${metaPills(c)}</div>
    <div class="front">${frontHtml(c)}</div>
    <button class="primary reveal">Hiện đáp án</button>
    <div class="back hidden">${backHtml(c)}<textarea class="noteBox" placeholder="Ghi chú cá nhân...">${esc(app.state.notes[c.id]||'')}</textarea></div>
    <div class="rating hidden"><button data-rate="again" class="danger">Again</button><button data-rate="hard">Hard</button><button data-rate="good" class="primary">Good</button><button data-rate="easy" class="success">Easy</button></div>
  </article>`;
}
function metaPills(c){ return `<span class="pill">${esc(c.level)}</span><span class="pill">${c.kind==='kanji'?'Kanji':'Từ vựng'}</span><span class="pill">${esc(c.source)}</span><span class="pill">Trang ${c.page}</span><span class="pill">#${c.global_number||c.number}</span>`; }
function frontHtml(c){
  return `<div class="jp">${esc(c.title)}</div>${c.reading?`<div class="reading">${esc(c.reading)}</div>`:''}${c.hanviet?`<div class="hanviet">${esc(c.hanviet)}</div>`:''}`;
}
function backHtml(c){
  return `<div class="answer-title">Đáp án</div>
    ${frontHtml(c)}
    ${c.meaning_vi?`<div class="meaning">${esc(c.meaning_vi)}</div>`:''}
    ${c.example?`<pre class="raw">${esc(c.example)}</pre>`:''}
    ${app.state.settings.showRaw?`<details open><summary>Nội dung gốc đã trích từ PDF</summary><pre class="raw">${esc(c.raw)}</pre></details>`:''}`;
}
function rateCard(card, rate){
  const note=$('.noteBox'); if(note){ app.state.notes[card.id]=note.value; }
  const p=app.state.progress[card.id] || {ease:2.5, interval:0, reviewCount:0, correct:0, wrong:0};
  const t=now();
  p.reviewCount=(p.reviewCount||0)+1;
  p.lastReviewedAt=t; p.lastRating=rate;
  if(rate==='again'){
    p.wrong=(p.wrong||0)+1; p.interval=0; p.dueAt=t+minutes(10); p.ease=Math.max(1.3,(p.ease||2.5)-0.25);
  }else if(rate==='hard'){
    p.wrong=(p.wrong||0)+1; p.correct=(p.correct||0)+1; p.interval=Math.max(1, Math.round((p.interval||1)*1.2)); p.dueAt=t+days(p.interval); p.ease=Math.max(1.4,(p.ease||2.5)-0.1);
  }else if(rate==='good'){
    p.correct=(p.correct||0)+1; p.interval=(p.interval||0)===0 ? 1 : Math.round((p.interval||1)*(p.ease||2.5)); p.dueAt=t+days(p.interval);
  }else{
    p.correct=(p.correct||0)+1; p.interval=(p.interval||0)===0 ? 4 : Math.round((p.interval||1)*3.5); p.dueAt=t+days(p.interval); p.ease=(p.ease||2.5)+0.12;
  }
  app.state.progress[card.id]=p;
  app.state.history.push({id:card.id, rate, at:t});
  if(app.state.history.length>2000) app.state.history=app.state.history.slice(-2000);
  saveState();
  const s=app.currentStudy;
  if(s.index < s.deck.length-1){ s.index++; renderStudyCard(); }
  else { $('#studyArea').innerHTML = `<div class="panel"><h2>Xong phiên học</h2><p>Bạn đã hoàn thành ${s.deck.length} thẻ.</p><button class="primary" onclick="renderDashboard();activateNav('dashboard')">Về hôm nay</button></div>`; }
}

function renderQuiz(){
  $('#view').innerHTML = `<section class="panel"><h2>Quiz nhanh</h2><p class="muted">Chọn nghĩa đúng. Sai sẽ được ghi vào “Từ yếu”.</p><div id="quizArea"></div></section>`;
  nextQuiz();
}
function nextQuiz(){
  const deck=filteredCards().filter(c=>c.meaning_vi && c.title).slice();
  if(deck.length<4){ $('#quizArea').innerHTML='<div class="warning">Cần ít nhất 4 thẻ có nghĩa để tạo quiz.</div>'; return; }
  const card=shuffle(deck)[0];
  const options=shuffle([card, ...shuffle(deck.filter(c=>c.id!==card.id)).slice(0,3)]);
  app.quiz={card, options, answered:false};
  $('#quizArea').innerHTML=`
    <div class="study-card">
      <div class="card-meta">${metaPills(card)}</div>
      <div class="front">${frontHtml(card)}</div>
      <div>${options.map(o=>`<button class="quiz-option" data-id="${o.id}">${esc(o.meaning_vi||o.hanviet||o.reading||'')}</button>`).join('')}</div>
      <div class="toolbar"><button id="nextQuiz">Câu tiếp theo</button></div>
    </div>`;
  $all('.quiz-option').forEach(btn=>btn.onclick=()=>answerQuiz(btn));
  $('#nextQuiz').onclick=nextQuiz;
}
function answerQuiz(btn){
  if(app.quiz.answered) return;
  app.quiz.answered=true;
  const ok=btn.dataset.id===app.quiz.card.id;
  $all('.quiz-option').forEach(b=>{
    if(b.dataset.id===app.quiz.card.id) b.classList.add('correct');
    else if(b===btn) b.classList.add('wrong');
  });
  rateSilently(app.quiz.card, ok?'good':'again');
}
function rateSilently(card, rate){
  const p=app.state.progress[card.id] || {ease:2.5, interval:0, reviewCount:0, correct:0, wrong:0};
  p.reviewCount=(p.reviewCount||0)+1; p.lastReviewedAt=now(); p.lastRating=rate;
  if(rate==='again'){ p.wrong=(p.wrong||0)+1; p.interval=0; p.dueAt=now()+minutes(10); }
  else { p.correct=(p.correct||0)+1; p.interval=(p.interval||0)===0?1:Math.round((p.interval||1)*(p.ease||2.5)); p.dueAt=now()+days(p.interval); }
  app.state.progress[card.id]=p; saveState();
}

function renderDrive(){
  const deck=filteredCards().slice(0,300);
  app.drive.list=deck;
  $('#view').innerHTML=`
    <section class="panel">
      <h2>Drive Mode</h2>
      <p class="muted">App đọc: từ/Kanji → cách đọc → nghĩa. Dùng SpeechSynthesis của trình duyệt, không cần server.</p>
      <div class="drive-box">
        <div class="progressbar"><span id="driveProgress"></span></div>
        <div class="drive-word" id="driveWord">Sẵn sàng</div>
        <div id="driveMeaning" class="meaning muted">${deck.length} thẻ trong bộ lọc hiện tại</div>
        <div class="toolbar" style="justify-content:center">
          <button class="primary" id="driveStart">Bắt đầu</button>
          <button id="driveNext">Tiếp</button>
          <button id="driveStop" class="danger">Dừng</button>
        </div>
      </div>
    </section>`;
  $('#driveStart').onclick=startDrive;
  $('#driveNext').onclick=()=>{ app.drive.active=true; app.drive.index=Math.min(app.drive.index+1, app.drive.list.length-1); speakDriveCurrent(); };
  $('#driveStop').onclick=stopDrive;
}
function startDrive(){ if(!app.drive.list.length) return; app.drive.active=true; app.drive.index=0; speakDriveCurrent(); }
function stopDrive(){ app.drive.active=false; if('speechSynthesis' in window) speechSynthesis.cancel(); }
function speak(text, lang){
  return new Promise(resolve=>{
    if(!('speechSynthesis' in window) || !text){ resolve(); return; }
    const u=new SpeechSynthesisUtterance(text); u.lang=lang; u.rate=.9; u.onend=resolve; u.onerror=resolve; speechSynthesis.speak(u);
  });
}
async function speakDriveCurrent(){
  if(!app.drive.active) return;
  if(!app.drive.list.length) return;
  speechSynthesis.cancel();
  const c=app.drive.list[app.drive.index];
  $('#driveWord').textContent=c.title;
  $('#driveMeaning').textContent=[c.reading,c.hanviet,c.meaning_vi].filter(Boolean).join(' · ');
  $('#driveProgress').style.width=`${((app.drive.index+1)/app.drive.list.length)*100}%`;
  app.drive.active=true;
  await speak(c.title, 'ja-JP');
  await wait(app.state.settings.driveDelay||1200);
  if(c.reading) await speak(c.reading, 'ja-JP');
  if(c.hanviet) await speak(c.hanviet, 'vi-VN');
  if(c.meaning_vi) await speak(c.meaning_vi, 'vi-VN');
  if(app.drive.active && app.drive.index < app.drive.list.length-1){ app.drive.index++; setTimeout(speakDriveCurrent, app.state.settings.driveDelay||1200); }
}
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

function renderLibrary(){
  const cards=filteredCards();
  const pages=Math.max(1, Math.ceil(cards.length/app.pageSize));
  app.page=Math.min(app.page,pages);
  const slice=cards.slice((app.page-1)*app.pageSize, app.page*app.pageSize);
  $('#view').innerHTML=`
    <section class="panel">
      <h2>Danh sách thẻ</h2>
      <p class="muted">${cards.length} thẻ phù hợp bộ lọc. Click “Học” để mở thẻ đó.</p>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>Nhật</th><th>Đọc/Hán-Việt</th><th>Nghĩa</th><th>Nguồn</th><th></th></tr></thead><tbody>
        ${slice.map(c=>`<tr><td>${c.global_number||c.number}</td><td class="jp-cell">${esc(c.title)}</td><td>${esc([c.reading,c.hanviet].filter(Boolean).join(' · '))}</td><td>${esc(c.meaning_vi||'')}</td><td>${esc(c.level)} · ${c.kind} · trang ${c.page}</td><td><button data-open="${c.id}">Học</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="pagination"><button id="prevPage">←</button><span>Trang ${app.page}/${pages}</span><button id="nextPage">→</button></div>
    </section>`;
  $('#prevPage').onclick=()=>{ app.page=Math.max(1,app.page-1); renderLibrary(); };
  $('#nextPage').onclick=()=>{ app.page=Math.min(pages,app.page+1); renderLibrary(); };
  $all('[data-open]').forEach(b=>b.onclick=()=>{ const c=app.cards.find(x=>x.id===b.dataset.open); app.view='study'; activateNav('study'); app.currentStudy={mode:'single',deck:[c],index:0}; renderStudy(); renderStudyCard(); });
}

function renderMistakes(){
  const weak=filteredCards().filter(c=>(getP(c).wrong||0)>0).sort((a,b)=>(getP(b).wrong||0)-(getP(a).wrong||0));
  $('#view').innerHTML=`
    <section class="panel">
      <h2>Từ yếu / Kanji yếu</h2>
      <p class="muted">Các thẻ bạn bấm Again/Hard hoặc trả lời sai quiz.</p>
      ${weak.length?`<div class="table-wrap"><table><thead><tr><th>Nhật</th><th>Nghĩa</th><th>Sai</th><th>Đúng</th><th>Lần ôn tới</th></tr></thead><tbody>${weak.map(c=>{const p=getP(c);return `<tr><td class="jp-cell">${esc(c.title)}<br><span class="small muted">${esc(c.reading||c.hanviet||'')}</span></td><td>${esc(c.meaning_vi||'')}</td><td>${p.wrong||0}</td><td>${p.correct||0}</td><td>${fmtDate(p.dueAt)}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="warning">Chưa có dữ liệu lỗi sai.</div>'}
    </section>`;
}

function renderSettings(){
  const s=app.state.settings;
  $('#view').innerHTML=`
    <section class="panel">
      <h2>Cài đặt</h2>
      <div class="form-grid">
        <label>Số thẻ mới mỗi ngày<input id="newPerDay" type="number" min="1" max="150" value="${s.newPerDay||30}"></label>
        <label>Khoảng nghỉ Drive Mode / ms<input id="driveDelay" type="number" min="200" max="5000" step="100" value="${s.driveDelay||1200}"></label>
        <label>Hiện nội dung gốc PDF<select id="showRaw"><option value="true">Có</option><option value="false">Không</option></select></label>
      </div>
      <div class="toolbar"><button class="primary" id="saveSettings">Lưu cài đặt</button><button id="importBtn">Nhập tiến độ</button><button class="danger" id="resetBtn">Xóa tiến độ</button></div>
      <input id="importFile" type="file" accept="application/json" class="hidden">
      <div class="warning small">Lưu ý: dữ liệu tiến độ nằm trong localStorage của trình duyệt. Nếu đổi máy/trình duyệt, hãy xuất tiến độ rồi nhập lại.</div>
    </section>
    <section class="panel"><h2>Thông tin dữ liệu</h2>${dataInfo()}</section>`;
  $('#showRaw').value=String(!!s.showRaw);
  $('#saveSettings').onclick=()=>{ s.newPerDay=Number($('#newPerDay').value)||30; s.driveDelay=Number($('#driveDelay').value)||1200; s.showRaw=$('#showRaw').value==='true'; saveState(); alert('Đã lưu cài đặt'); };
  $('#resetBtn').onclick=()=>{ if(confirm('Xóa toàn bộ tiến độ học?')){ app.state=defaultState(); saveState(); renderSettings(); } };
  $('#importBtn').onclick=()=>$('#importFile').click();
  $('#importFile').onchange=importProgress;
}
function dataInfo(){
  const grouped={}; app.cards.forEach(c=>{ const k=`${c.level} · ${c.kind==='kanji'?'Kanji':'Từ vựng'}`; grouped[k]=(grouped[k]||0)+1; });
  return `<div class="grid stats">${Object.entries(grouped).map(([k,v])=>stat(k,v)).join('')}</div>`;
}

function exportProgress(){
  const blob=new Blob([JSON.stringify(app.state,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='nihongo-progress.json'; a.click(); URL.revokeObjectURL(a.href);
}
function importProgress(e){
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=()=>{ try{ app.state=JSON.parse(r.result); saveState(); alert('Đã nhập tiến độ'); render(); }catch(err){ alert('File không hợp lệ'); } };
  r.readAsText(file);
}
function shuffle(arr){ return arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }

init();
