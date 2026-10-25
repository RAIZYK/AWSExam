(() => {
  const API = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL || "").replace(/\/$/, "");
  const $ = id => document.getElementById(id);
  const state = { mode:"practice", questions:[], answers:{}, flags:new Set(), index:0, results:[], examId:"", seconds:0, timerId:null, submitted:false };
  const domains = {"cloud-technology":"CLOUD TECHNOLOGY","security":"SECURITY & COMPLIANCE","billing":"BILLING & PRICING"};
  const letters = ["A","B","C","D","E","F"];
  async function api(path, options={}) {
    const response = await fetch(`${API}${path}`, {headers:{"Content-Type":"application/json", ...(options.headers||{})}, ...options});
    const data = await response.json().catch(()=>({detail:"Unexpected server response"}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  }
  function toast(message) {
    $("toast").textContent = message; $("toast").classList.remove("hidden");
    clearTimeout(toast.timeout); toast.timeout = setTimeout(()=>$("toast").classList.add("hidden"), 3200);
  }
  function show(view) { ["home-view","exam-view","result-view"].forEach(id=>$(id).classList.toggle("hidden",id!==view)); window.scrollTo({top:0,behavior:"smooth"}); }
  function answeredCount(){return Object.keys(state.answers).filter(k=>state.answers[k] !== undefined).length;}
  function startTimer(minutes) {
    clearInterval(state.timerId);
    if (!minutes) {$("timer").textContent="Untimed";return;}
    state.seconds=minutes*60; renderTimer();
    state.timerId=setInterval(()=>{state.seconds--;renderTimer();if(state.seconds<=0){clearInterval(state.timerId);toast("Время вышло — ответы отправляются.");submitExam(true);}},1000);
  }
  function renderTimer(){const m=Math.floor(Math.max(0,state.seconds)/60),s=Math.max(0,state.seconds)%60;$("timer").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;if(state.seconds<300)$("timer").style.color="var(--red)";else $("timer").style.color="var(--text)";}
  async function startExam() {
    const btn=$("start-btn");btn.disabled=true;btn.textContent="Загружаем вопросы…";
    try {
      state.mode=$("mode").value;
      const payload={limit:Number($("count").value),mode:state.mode,domain:$("domain").value||null,shuffle:true};
      const exam=await api("/api/quiz/exams",{method:"POST",body:JSON.stringify(payload)});
      state.questions=exam.questions;state.examId=exam.exam_id;state.answers={};state.flags=new Set();state.index=0;state.results=[];state.submitted=false;
      $("exam-title").textContent=state.mode==="exam"?"Exam simulation":"Practice session";
      $("practice-feedback").classList.add("hidden");
      show("exam-view");renderQuestion();startTimer(exam.time_limit_minutes);
    } catch(e){toast(`Не удалось загрузить экзамен: ${e.message}`);}
    finally{btn.disabled=false;btn.innerHTML='Начать тренировку <span>→</span>';}
  }
  function renderQuestion() {
    const q=state.questions[state.index];if(!q)return;
    $("progress-text").textContent=`Question ${state.index+1} of ${state.questions.length}`;
    $("answered-text").textContent=`${answeredCount()} answered`;
    $("progress-bar").style.width=`${answeredCount()/state.questions.length*100}%`;
    $("question-number").textContent=`QUESTION ${String(state.index+1).padStart(2,"0")}`;
    $("question-domain").textContent=domains[q.domain]||q.domain.toUpperCase();
    $("question-text").textContent=q.question;
    $("prev-btn").disabled=state.index===0;$("prev-btn").style.opacity=state.index===0?".4":"1";
    $("next-btn").textContent=state.index===state.questions.length-1?"Перейти к результатам →":"Следующий вопрос →";
    const flag=state.flags.has(q.id);$("flag-btn").classList.toggle("active",flag);$("flag-btn").textContent=flag?"★ Marked for review":"☆ Mark for review";
    const feedback=$("practice-feedback");feedback.classList.add("hidden");
    $("options").replaceChildren();
    q.options.forEach((option,i)=>{
      const b=document.createElement("button");b.className="option";b.type="button";
      if(state.answers[q.id]===i)b.classList.add("selected");
      const letter=document.createElement("span");letter.className="letter";letter.textContent=letters[i]||String(i+1);
      const text=document.createElement("span");text.textContent=option;b.append(letter,text);
      b.addEventListener("click",()=>selectAnswer(q,i));$("options").append(b);
    });
    renderNav();
  }
  function selectAnswer(q,i) {
    if(state.submitted)return;
    state.answers[q.id]=i;
    [...$("options").children].forEach((b,j)=>b.classList.toggle("selected",i===j));
    $("answered-text").textContent=`${answeredCount()} answered`;
    $("progress-bar").style.width=`${answeredCount()/state.questions.length*100}%`;
    renderNav();
    if(state.mode==="practice") {
      api("/api/quiz/grade",{method:"POST",body:JSON.stringify({answers:[{question_id:q.id,selected_index:i}]})}).then(g=>{
        const r=g.results[0];const fb=$("practice-feedback");fb.classList.remove("hidden");
        fb.innerHTML="";
        const strong=document.createElement("strong");strong.textContent=r.is_correct?"Correct — well done.":"Not quite. Correct answer: "+r.correct_answer;
        const p=document.createElement("div");p.textContent=r.explanation;fb.append(strong,p);
        [...$("options").children].forEach((b,j)=>{b.classList.toggle("correct",j===r.correct_index);b.classList.toggle("incorrect",j===i&&!r.is_correct);});
      }).catch(()=>{});
    }
  }
  function renderNav(){
    const nav=$("question-nav");nav.replaceChildren();
    state.questions.forEach((q,i)=>{const b=document.createElement("button");b.className="nav-number";b.textContent=i+1;
      if(i===state.index)b.classList.add("current");if(state.answers[q.id]!==undefined)b.classList.add("done");if(state.flags.has(q.id))b.classList.add("flagged");
      b.setAttribute("aria-label",`Question ${i+1}${state.flags.has(q.id)?", marked for review":""}`);b.addEventListener("click",()=>{state.index=i;renderQuestion();});nav.append(b);});
  }
  function requestSubmit(){const missing=state.questions.length-answeredCount();$("modal-title").textContent="Завершить попытку?";
    $("modal-message").textContent=missing?`Осталось без ответа: ${missing}. Завершить и проверить текущие ответы?`:"Все вопросы отвечены. Отправить ответы?";
    $("confirm-submit").textContent="Завершить";$("confirm-modal").classList.remove("hidden");}
  async function submitExam(auto=false){
    if(state.submitted)return;
    $("confirm-modal").classList.add("hidden");
    const answers=state.questions.filter(q=>state.answers[q.id]!==undefined).map(q=>({question_id:q.id,selected_index:state.answers[q.id]}));
    if(!answers.length){toast("Ответь хотя бы на один вопрос перед завершением.");return;}
    state.submitted=true;clearInterval(state.timerId);
    try{
      const grade=await api("/api/quiz/grade",{method:"POST",body:JSON.stringify({answers})});
      state.results=grade.results;
      try{await api("/api/results/",{method:"POST",body:JSON.stringify({exam_id:state.examId,mode:state.mode,total:grade.total,correct:grade.correct,score_percent:grade.score_percent,passed:grade.passed})});}
      catch(e){toast("Результат рассчитан, но не удалось сохранить историю.");}
      renderResults(grade);show("result-view");if(auto)toast("Попытка завершена автоматически.");
    }catch(e){state.submitted=false;toast(`Не удалось проверить ответы: ${e.message}`);}
  }
  function renderResults(g){
    $("result-title").textContent=g.passed?"Great progress!":"Keep building your cloud skills.";
    $("result-subtitle").textContent=g.passed?"Ты достиг учебной цели в 70%. Продолжай практиковаться.":"Цель этой тренировки — 70%. Посмотри разбор и попробуй ещё раз.";
    $("score-value").textContent=`${g.score_percent}%`;
    $("score-ring").style.background=`conic-gradient(${g.passed?"var(--green)":"var(--blue)"} ${g.score_percent}%,#26354c ${g.score_percent}%)`;
    $("pass-label").textContent=g.passed?"Target reached":"More practice recommended";
    $("score-detail").textContent=`${g.correct} of ${g.total} correct`;
    $("correct-stat").textContent=g.correct;$("incorrect-stat").textContent=g.incorrect;$("answered-stat").textContent=`${answeredCount()} / ${state.questions.length}`;
    renderReview();
  }
  function renderReview(){
    const filter=$("review-filter").value;const list=$("review-list");list.replaceChildren();
    state.questions.forEach((q,i)=>{
      const r=state.results.find(x=>x.question_id===q.id);if(!r)return;
      if(filter==="correct"&&!r.is_correct||filter==="incorrect"&&r.is_correct)return;
      const article=document.createElement("article");article.className="review-item";
      const status=document.createElement("div");status.className=`review-status ${r.is_correct?"good":"bad"}`;status.textContent=`${r.is_correct?"✓ CORRECT":"✕ INCORRECT"} · QUESTION ${i+1}`;
      const title=document.createElement("h3");title.textContent=q.question;article.append(status,title);
      const yours=document.createElement("div");yours.className="review-answer";yours.textContent="Your answer: "+(q.options[r.selected_index]||"No answer");
      const correct=document.createElement("div");correct.className="review-answer";correct.textContent="Correct answer: "+r.correct_answer;
      const explanation=document.createElement("p");explanation.textContent=r.explanation;
      article.append(yours,correct,explanation);list.append(article);
    });
    if(!list.children.length){const p=document.createElement("p");p.textContent="Нет вопросов для выбранного фильтра.";p.style.color="var(--muted)";list.append(p);}
  }
  async function loadHistory(){
    $("history-section").classList.remove("hidden");$("history-list").replaceChildren();
    try{
      const data=await api("/api/results/?limit=20");
      if(!data.results.length){$("history-list").textContent="Пока нет сохранённых результатов.";return;}
      data.results.forEach(r=>{const row=document.createElement("div");row.className="history-row";
        const left=document.createElement("span");left.textContent=`${r.mode==="exam"?"Exam":"Practice"} · ${r.correct}/${r.total} correct`;
        const right=document.createElement("strong");right.textContent=`${r.score_percent}%`;
        row.append(left,right);$("history-list").append(row);});
    }catch(e){$("history-list").textContent="История недоступна: "+e.message;}
  }
  $("start-btn").addEventListener("click",startExam);
  $("prev-btn").addEventListener("click",()=>{if(state.index>0){state.index--;renderQuestion();}});
  $("next-btn").addEventListener("click",()=>{if(state.index<state.questions.length-1){state.index++;renderQuestion();}else requestSubmit();});
  $("flag-btn").addEventListener("click",()=>{const id=state.questions[state.index].id;state.flags.has(id)?state.flags.delete(id):state.flags.add(id);renderQuestion();});
  $("submit-btn").addEventListener("click",requestSubmit);
  $("cancel-submit").addEventListener("click",()=>$("confirm-modal").classList.add("hidden"));
  $("confirm-submit").addEventListener("click",()=>submitExam(false));
  $("retry-btn").addEventListener("click",()=>{show("home-view");$("history-section").classList.add("hidden");});
  $("history-btn").addEventListener("click",loadHistory);
  $("review-filter").addEventListener("change",renderReview);
  document.addEventListener("keydown",e=>{if($("exam-view").classList.contains("hidden")||state.submitted)return;
    if(["1","2","3","4"].includes(e.key)){const q=state.questions[state.index];if(q)selectAnswer(q,Number(e.key)-1);}
    if(e.key==="ArrowRight"&&state.index<state.questions.length-1){state.index++;renderQuestion();}
    if(e.key==="ArrowLeft"&&state.index>0){state.index--;renderQuestion();}
  });
})();
