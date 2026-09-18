(function () {
  "use strict";

  var STORAGE_KEY = "rdc-boat-crew:v2";
  var DEFAULT_STATUS = "maybe";
  var EMPTY_BOAT_WEIGHT = 250;
  var WEIGHT_DIFF_FOR_FULL_TINT = 200;
  var WEIGHT_TINT_MIN_INTENSITY = 0.12;

  var STATUS_LIST = [
    { key: "approved", label: "Утверждено" },
    { key: "questioned", label: "Под вопросом" },
    { key: "maybe", label: "Возможно" }
  ];

  var DEFAULT_ROWER_NAMES = [
    "Пре**ев", "Лап**ев", "Шма**ов", "Кли**ов", "Сте**ов",
    "Слу**ий", "Ант**ов", "Кра**ко", "Сам**ин", "Мед**ев",
    "Лих**ёв", "Дол**ко", "Ино**ев", "Лед**ёв", "Ва**ин",
    "Сол**ко", "Тим**ев"
  ];

  var DEFAULT_SEAT_ASSIGNMENTS = {
    "person-1": "bank-2-l",
    "person-2": "bank-4-l",
    "person-3": "bank-6-l",
    "person-4": "bank-7-l",
    "person-5": "bank-8-l",
    "person-6": "bank-9-l",
    "person-7": "bank-10-l",
    "person-8": "bank-2-r",
    "person-9": "bank-3-r",
    "person-10": "bank-4-r",
    "person-11": "bank-5-r",
    "person-12": "bank-6-r",
    "person-13": "bank-7-r",
    "person-14": "bank-8-r",
    "person-15": "bank-9-r",
    "person-16": "bank-10-r",
    "person-18": "bank-5-l",
    "person-steer": "steer"
  };

  var SEATS = buildSeatDefinitions();
  var state = loadState();
  var activeModalSeatId = null;
  var activeModalMode = "pick";
  var suppressNextClick = false;

  function buildSeatDefinitions() {
    var seats = [{ id: "drummer", label: "Барабанщик", fullLabel: "Барабанщик" }];
    for (var i = 1; i <= 10; i++) {
      seats.push({ id: "bank-" + i + "-l", label: "Б" + i + " / Л", fullLabel: "Банка " + i + " · лево" });
      seats.push({ id: "bank-" + i + "-r", label: "Б" + i + " / П", fullLabel: "Банка " + i + " · право" });
    }
    seats.push({ id: "steer", label: "Рулевой", fullLabel: "Рулевой" });
    return seats;
  }

  function findSeat(id) {
    for (var i = 0; i < SEATS.length; i++) {
      if (SEATS[i].id === id) return SEATS[i];
    }
    return null;
  }

  function defaultPeople() {
    var people = [];
    var genericIndex = 1;
    for (var i = 1; i <= 20; i++) {
      var name = DEFAULT_ROWER_NAMES[i - 1] || ("Человек " + genericIndex++);
      people.push({ id: "person-" + i, name: name, weight: 80, seatId: null, status: null });
    }
    people.push({ id: "person-drummer", name: "Человек " + genericIndex++, weight: 80, seatId: null, status: null });
    people.push({ id: "person-steer", name: "Бор**ин", weight: 80, seatId: null, status: null });

    var davydov = people.filter(function (p) { return p.id === "person-18"; })[0];
    if (davydov) davydov.name = "Дав**в";

    people.forEach(function (p) {
      var seatId = DEFAULT_SEAT_ASSIGNMENTS[p.id];
      if (seatId) {
        p.seatId = seatId;
        p.status = DEFAULT_STATUS;
      }
    });

    return people;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { people: defaultPeople() };
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.people)) return { people: defaultPeople() };
      return parsed;
    } catch (e) {
      console.error("Не удалось прочитать сохранённые данные", e);
      return { people: defaultPeople() };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Не удалось сохранить данные", e);
    }
  }

  function findPerson(id) {
    for (var i = 0; i < state.people.length; i++) {
      if (state.people[i].id === id) return state.people[i];
    }
    return null;
  }

  function findOccupant(seatId) {
    for (var i = 0; i < state.people.length; i++) {
      if (state.people[i].seatId === seatId) return state.people[i];
    }
    return null;
  }

  function assignPersonToSeat(personId, seatId) {
    var person = findPerson(personId);
    if (!person) return;
    state.people.forEach(function (other) {
      if (other.seatId === seatId && other.id !== personId) {
        other.seatId = null;
        other.status = null;
      }
    });
    person.seatId = seatId;
    if (!person.status) person.status = DEFAULT_STATUS;
    saveState();
  }

  function unassignPerson(personId) {
    var person = findPerson(personId);
    if (!person) return;
    person.seatId = null;
    person.status = null;
    saveState();
  }

  function setStatus(personId, status) {
    var person = findPerson(personId);
    if (!person || !person.seatId) return;
    person.status = status;
    saveState();
  }

  function getSeatSide(seatId) {
    if (/-l$/.test(seatId)) return "l";
    if (/-r$/.test(seatId)) return "r";
    return null;
  }

  function parseBankNumber(seatId) {
    var m = /^bank-(\d+)-[lr]$/.exec(seatId);
    return m ? parseInt(m[1], 10) : null;
  }

  function cascadeShift(side, fromSeatId, toSeatId) {
    var fromIdx = parseBankNumber(fromSeatId);
    var toIdx = parseBankNumber(toSeatId);
    if (fromIdx === null || toIdx === null) return;
    var dir = fromIdx > toIdx ? 1 : -1;

    var carry = findOccupant(toSeatId);
    while (carry) {
      var currentIdx = parseBankNumber(carry.seatId);
      var nextIdx = currentIdx + dir;
      var nextSeatId = "bank-" + nextIdx + "-" + side;
      var nextOccupant = nextIdx === fromIdx ? null : findOccupant(nextSeatId);
      carry.seatId = nextSeatId;
      carry = nextOccupant;
    }
  }

  function handleSeatDrop(sourcePersonId, sourceSeatId, targetSeatId) {
    if (!targetSeatId || sourceSeatId === targetSeatId) return;
    var sourcePerson = findPerson(sourcePersonId);
    if (!sourcePerson || sourcePerson.seatId !== sourceSeatId) return;

    var sourceSide = getSeatSide(sourceSeatId);
    var targetSide = getSeatSide(targetSeatId);
    var targetOccupant = findOccupant(targetSeatId);

    if (sourceSide && sourceSide === targetSide) {
      if (targetOccupant) cascadeShift(sourceSide, sourceSeatId, targetSeatId);
      sourcePerson.seatId = targetSeatId;
      saveState();
    } else if (sourceSide === null && targetSide === null) {
      if (targetOccupant) targetOccupant.seatId = sourceSeatId;
      sourcePerson.seatId = targetSeatId;
      saveState();
    } else {
      assignPersonToSeat(sourcePersonId, targetSeatId);
    }
    renderBoat();
  }

  function addPerson() {
    var id = "person-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    state.people.push({ id: id, name: "Новый участник", weight: 80, seatId: null, status: null });
    saveState();
    renderSeatModal();
    requestAnimationFrame(function () {
      var input = document.querySelector('[data-person-id="' + id + '"] .person-name');
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  function deletePerson(id) {
    state.people = state.people.filter(function (p) { return p.id !== id; });
    saveState();
    renderBoat();
    renderSeatModal();
  }

  /* ===== Rendering: boat ===== */

  function render() {
    renderBoat();
    renderCrewCount();
  }

  function renderCrewCount() {
    var assigned = state.people.filter(function (p) { return p.seatId; }).length;
    document.getElementById("crew-count").textContent = assigned + " / " + state.people.length + " в лодке";
  }

  function computeWeights() {
    var left = 0, right = 0, total = 0;
    state.people.forEach(function (p) {
      if (!p.seatId) return;
      total += p.weight;
      if (/-l$/.test(p.seatId)) left += p.weight;
      else if (/-r$/.test(p.seatId)) right += p.weight;
    });
    return { left: left, right: right, total: total + EMPTY_BOAT_WEIGHT };
  }

  function applyTint(el, tintClassPrefix, kind, intensity) {
    el.classList.remove(tintClassPrefix + "--heavy", tintClassPrefix + "--light");
    if (kind) {
      el.classList.add(tintClassPrefix + "--" + kind);
      el.style.setProperty("--tint-alpha", intensity.toFixed(2));
    } else {
      el.style.removeProperty("--tint-alpha");
    }
  }

  function renderWeights() {
    var w = computeWeights();
    document.getElementById("weight-left-value").textContent = w.left + " кг";
    document.getElementById("weight-right-value").textContent = w.right + " кг";
    document.getElementById("weight-total-value").textContent = w.total + " кг";

    var diff = w.left - w.right;
    var ratio = Math.min(Math.abs(diff), WEIGHT_DIFF_FOR_FULL_TINT) / WEIGHT_DIFF_FOR_FULL_TINT;
    var intensity = diff === 0 ? 0 : WEIGHT_TINT_MIN_INTENSITY + ratio * (1 - WEIGHT_TINT_MIN_INTENSITY);
    var leftKind = diff > 0 ? "heavy" : (diff < 0 ? "light" : null);
    var rightKind = diff < 0 ? "heavy" : (diff > 0 ? "light" : null);

    applyTint(document.getElementById("weight-left"), "weight-item", leftKind, intensity);
    applyTint(document.getElementById("weight-right"), "weight-item", rightKind, intensity);

    var sideLeft = document.getElementById("side-tint-left");
    var sideRight = document.getElementById("side-tint-right");
    if (sideLeft) applyTint(sideLeft, "side-tint", leftKind, intensity);
    if (sideRight) applyTint(sideRight, "side-tint", rightKind, intensity);
  }

  function renderBoat() {
    var hull = document.getElementById("boat-hull");
    hull.innerHTML = "";

    var sideLeft = document.createElement("div");
    sideLeft.id = "side-tint-left";
    sideLeft.className = "side-tint side-tint--left";
    hull.appendChild(sideLeft);

    var sideRight = document.createElement("div");
    sideRight.id = "side-tint-right";
    sideRight.className = "side-tint side-tint--right";
    hull.appendChild(sideRight);

    hull.appendChild(renderSeatSlot(findSeat("drummer")));

    var rowsWrap = document.createElement("div");
    rowsWrap.className = "boat-rows";

    for (var i = 1; i <= 10; i++) {
      var rowEl = document.createElement("div");
      rowEl.className = "boat-row";
      rowEl.appendChild(renderSeatSlot(findSeat("bank-" + i + "-l")));
      rowEl.appendChild(renderSeatSlot(findSeat("bank-" + i + "-r")));
      rowsWrap.appendChild(rowEl);
    }
    hull.appendChild(rowsWrap);
    hull.appendChild(renderSeatSlot(findSeat("steer")));

    renderCrewCount();
    renderWeights();
  }

  function renderSeatSlot(seatDef) {
    var occupant = findOccupant(seatDef.id);

    var wrap = document.createElement("div");
    wrap.className = "seat-slot";

    var seat = document.createElement("div");
    seat.className = "seat" + (occupant ? " seat--filled" : "");
    if (occupant && occupant.status) seat.classList.add("seat--" + occupant.status);
    seat.dataset.seatId = seatDef.id;
    seat.title = seatDef.fullLabel;

    var mainBtn = document.createElement("button");
    mainBtn.type = "button";
    mainBtn.className = "seat-main";
    mainBtn.setAttribute("aria-label", seatDef.fullLabel + (occupant ? ": " + occupant.name + " — выбрать человека" : ": свободно — выбрать человека"));

    if (occupant) {
      var nameSpan = document.createElement("span");
      nameSpan.className = "seat-name";
      nameSpan.textContent = occupant.name;
      mainBtn.appendChild(nameSpan);

      var weightSpan = document.createElement("span");
      weightSpan.className = "seat-weight";
      weightSpan.textContent = occupant.weight + " кг";
      mainBtn.appendChild(weightSpan);
    } else {
      var labelSpan = document.createElement("span");
      labelSpan.className = "seat-label";
      labelSpan.textContent = seatDef.label;
      mainBtn.appendChild(labelSpan);
    }

    mainBtn.addEventListener("click", function () {
      if (suppressNextClick) { suppressNextClick = false; return; }
      openSeatModal(seatDef.id, "pick");
    });
    if (occupant) attachSeatDrag(mainBtn, seat, seatDef.id, occupant.id);
    seat.appendChild(mainBtn);

    if (occupant) {
      var statusBtn = document.createElement("button");
      statusBtn.type = "button";
      statusBtn.className = "seat-status-zone";
      if (occupant.status) statusBtn.classList.add("seat-status-zone--" + occupant.status);
      statusBtn.setAttribute("aria-label", "Статус и снятие с места: " + seatDef.fullLabel);
      statusBtn.textContent = "⋮";
      statusBtn.addEventListener("click", function () { openSeatModal(seatDef.id, "manage"); });
      seat.appendChild(statusBtn);
    }

    wrap.appendChild(seat);
    return wrap;
  }

  function positionGhost(ghost, x, y) {
    ghost.style.left = x + "px";
    ghost.style.top = y + "px";
  }

  function attachSeatDrag(mainBtn, seatEl, sourceSeatId, personId) {
    mainBtn.addEventListener("pointerdown", function (e) {
      var startX = e.clientX, startY = e.clientY;
      var dragging = false;
      var ghost = null;
      var hoverSeatEl = null;

      function onMove(ev) {
        var dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (!dragging) {
          if (Math.hypot(dx, dy) < 6) return;
          dragging = true;
          var rect = seatEl.getBoundingClientRect();
          ghost = seatEl.cloneNode(true);
          ghost.classList.add("drag-ghost");
          ghost.style.width = rect.width + "px";
          ghost.style.height = rect.height + "px";
          document.body.appendChild(ghost);
          seatEl.classList.add("seat--dragging-source");
          document.body.classList.add("is-dragging");
        }
        ev.preventDefault();
        positionGhost(ghost, ev.clientX, ev.clientY);
        var target = document.elementFromPoint(ev.clientX, ev.clientY);
        var seatUnderPointer = target ? target.closest(".seat") : null;
        if (hoverSeatEl && hoverSeatEl !== seatUnderPointer) hoverSeatEl.classList.remove("seat--drag-hover");
        if (seatUnderPointer && seatUnderPointer !== seatEl) seatUnderPointer.classList.add("seat--drag-hover");
        hoverSeatEl = seatUnderPointer;
      }

      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);

        if (!dragging) return;
        if (hoverSeatEl) hoverSeatEl.classList.remove("seat--drag-hover");
        if (ghost) ghost.remove();
        seatEl.classList.remove("seat--dragging-source");
        document.body.classList.remove("is-dragging");
        suppressNextClick = true;

        if (hoverSeatEl && hoverSeatEl !== seatEl) {
          handleSeatDrop(personId, sourceSeatId, hoverSeatEl.dataset.seatId);
        }
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  }

  /* ===== Seat modal ===== */

  function openSeatModal(seatId, mode) {
    activeModalSeatId = seatId;
    activeModalMode = mode || "pick";
    renderSeatModal();
    document.getElementById("seat-modal").hidden = false;
  }

  function closeSeatModal() {
    activeModalSeatId = null;
    document.getElementById("seat-modal").hidden = true;
  }

  function renderSeatModal() {
    if (!activeModalSeatId) return;
    var seatDef = findSeat(activeModalSeatId);
    if (!seatDef) return;

    document.getElementById("seat-modal-title").textContent = seatDef.fullLabel;

    var occupant = findOccupant(seatDef.id);
    var currentWrap = document.getElementById("seat-modal-current");
    currentWrap.innerHTML = "";

    if (occupant) {
      var personRow = document.createElement("div");
      personRow.className = "modal-current-person";
      var nameSpan = document.createElement("span");
      nameSpan.className = "modal-current-name";
      nameSpan.textContent = occupant.name;
      personRow.appendChild(nameSpan);
      var weightSpan = document.createElement("span");
      weightSpan.className = "modal-current-weight";
      weightSpan.textContent = occupant.weight + " кг";
      personRow.appendChild(weightSpan);
      currentWrap.appendChild(personRow);

      if (activeModalMode === "manage") {
        var statusRow = document.createElement("div");
        statusRow.className = "status-row";
        STATUS_LIST.forEach(function (s) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "status-dot status-dot--" + s.key + (occupant.status === s.key ? " is-active" : "");
          btn.textContent = s.label;
          btn.addEventListener("click", function (statusKey) {
            return function () {
              setStatus(occupant.id, statusKey);
              renderBoat();
              closeSeatModal();
            };
          }(s.key));
          statusRow.appendChild(btn);
        });
        currentWrap.appendChild(statusRow);

        var removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn-remove-seat";
        removeBtn.textContent = "Снять с банки";
        removeBtn.addEventListener("click", function () {
          unassignPerson(occupant.id);
          renderBoat();
          closeSeatModal();
        });
        currentWrap.appendChild(removeBtn);
      }
    } else {
      var empty = document.createElement("p");
      empty.className = "modal-current-empty";
      empty.textContent = "Место свободно";
      currentWrap.appendChild(empty);
    }

    var pickSection = document.getElementById("seat-modal-pick-section");
    pickSection.hidden = activeModalMode !== "pick";

    if (activeModalMode === "pick") {
      var list = document.getElementById("seat-modal-list");
      list.innerHTML = "";
      state.people
        .filter(function (p) { return !occupant || p.id !== occupant.id; })
        .forEach(function (person) {
          list.appendChild(renderModalPersonRow(person, seatDef));
        });
    }
  }

  function renderModalPersonRow(person, seatDef) {
    var row = document.createElement("div");
    row.className = "modal-row";
    row.dataset.personId = person.id;

    var fields = document.createElement("div");
    fields.className = "modal-row-fields";

    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "person-name";
    nameInput.id = person.id + "-name";
    nameInput.name = person.id + "-name";
    nameInput.value = person.name;
    nameInput.maxLength = 40;
    nameInput.setAttribute("aria-label", "Имя");
    nameInput.setAttribute("autocomplete", "off");
    nameInput.addEventListener("change", function () {
      var value = nameInput.value.trim();
      person.name = value || person.name;
      nameInput.value = person.name;
      saveState();
      renderBoat();
    });
    fields.appendChild(nameInput);

    var weightWrap = document.createElement("label");
    weightWrap.className = "person-weight-wrap";
    var weightInput = document.createElement("input");
    weightInput.type = "number";
    weightInput.className = "person-weight";
    weightInput.id = person.id + "-weight";
    weightInput.name = person.id + "-weight";
    weightInput.value = person.weight;
    weightInput.min = "20";
    weightInput.max = "200";
    weightInput.setAttribute("aria-label", "Вес, кг");
    weightInput.setAttribute("autocomplete", "off");
    weightInput.addEventListener("change", function () {
      var value = parseInt(weightInput.value, 10);
      if (!isFinite(value) || value <= 0) value = person.weight;
      value = Math.min(200, Math.max(20, value));
      person.weight = value;
      weightInput.value = value;
      saveState();
      renderBoat();
    });
    weightWrap.appendChild(weightInput);
    var unit = document.createElement("span");
    unit.className = "unit";
    unit.textContent = "кг";
    weightWrap.appendChild(unit);
    fields.appendChild(weightWrap);

    row.appendChild(fields);

    if (person.seatId) {
      var otherSeat = findSeat(person.seatId);
      var badge = document.createElement("span");
      badge.className = "modal-row-badge";
      badge.textContent = otherSeat ? otherSeat.label : "";
      row.appendChild(badge);
    }

    var pickBtn = document.createElement("button");
    pickBtn.type = "button";
    pickBtn.className = "modal-row-pick";
    pickBtn.setAttribute("aria-label", "Посадить на это место");
    pickBtn.textContent = "→";
    pickBtn.addEventListener("click", function () {
      assignPersonToSeat(person.id, seatDef.id);
      renderBoat();
      closeSeatModal();
    });
    row.appendChild(pickBtn);

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "modal-row-delete";
    delBtn.setAttribute("aria-label", "Удалить участника");
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (confirm('Удалить «' + person.name + '» из списка?')) {
        deletePerson(person.id);
      }
    });
    row.appendChild(delBtn);

    return row;
  }

  /* ===== Intro ===== */

  function createExplosion(x, y) {
    var particles = [];
    for (var i = 0; i < 110; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        speed: 2.5 + Math.random() * 9,
        r: 1.5 + Math.random() * 4
      });
    }
    return { x: x, y: y, particles: particles };
  }

  function drawExplosion(ctx, explosion, elapsed, durationMs, width, height) {
    var p = Math.min(elapsed / durationMs, 1);
    var maxR = Math.hypot(width, height) * 0.62;

    var flashR = 10 + p * maxR;
    var flashAlpha = Math.max(0, 1 - p * 1.1);
    var grad = ctx.createRadialGradient(explosion.x, explosion.y, 0, explosion.x, explosion.y, flashR);
    grad.addColorStop(0, "rgba(255,255,255," + (flashAlpha * 0.95) + ")");
    grad.addColorStop(0.35, "rgba(150,220,255," + (flashAlpha * 0.6) + ")");
    grad.addColorStop(0.7, "rgba(120,90,255," + (flashAlpha * 0.3) + ")");
    grad.addColorStop(1, "rgba(74,227,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    [0, 0.1, 0.2, 0.32].forEach(function (delay) {
      var rp = Math.max(0, Math.min((elapsed - delay * durationMs) / (durationMs * 0.75), 1));
      if (rp <= 0) return;
      var r = 10 + rp * maxR * 0.9;
      ctx.beginPath();
      ctx.arc(explosion.x, explosion.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(74,227,255," + ((1 - rp) * 0.65) + ")";
      ctx.lineWidth = Math.max(1, 6 * (1 - rp));
      ctx.stroke();
    });

    explosion.particles.forEach(function (pt) {
      var dist = pt.speed * elapsed * 0.16;
      var px = explosion.x + Math.cos(pt.angle) * dist;
      var py = explosion.y + Math.sin(pt.angle) * dist;
      var alpha = Math.max(0, 1 - p);
      ctx.beginPath();
      ctx.arc(px, py, pt.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(235,250,255," + alpha + ")";
      ctx.shadowColor = "rgba(74,227,255,0.8)";
      ctx.shadowBlur = 10;
      ctx.fill();
    });
  }

  function initIntro() {
    var introEl = document.getElementById("intro");
    var skipBtn = document.getElementById("intro-skip");
    var canvas = document.getElementById("intro-canvas");
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      finish(true);
      return;
    }

    var ctx = canvas.getContext("2d");
    var raf = null;
    var width = 0, height = 0;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    }
    resize();
    window.addEventListener("resize", resize);

    var bubbles = [];
    for (var i = 0; i < 42; i++) bubbles.push(spawnBubble());

    function spawnBubble() {
      return {
        x: Math.random() * width,
        y: height + Math.random() * height,
        r: 1 + Math.random() * 2.6,
        speed: 0.3 + Math.random() * 0.9,
        drift: Math.random() * 0.6 - 0.3,
        phase: Math.random() * Math.PI * 2
      };
    }

    var waves = [
      { amp: 20, len: 260, speed: 0.012, phase: 0, y: 0.70, color: "rgba(74,227,255,0.32)" },
      { amp: 30, len: 340, speed: 0.009, phase: 2.1, y: 0.80, color: "rgba(150,110,255,0.24)" },
      { amp: 14, len: 170, speed: 0.020, phase: 4.2, y: 0.90, color: "rgba(74,227,255,0.16)" }
    ];

    var EXPLOSION_START = 2000;
    var EXPLOSION_MS = 950;
    var AUTO_FINISH_MS = EXPLOSION_START + EXPLOSION_MS * 0.7;

    var t = 0;
    var startTs = performance.now();
    var explosion = null;

    function frame() {
      t += 1;
      var elapsed = performance.now() - startTs;
      ctx.clearRect(0, 0, width, height);

      waves.forEach(function (w) {
        ctx.beginPath();
        var baseY = height * w.y;
        ctx.moveTo(0, baseY);
        for (var x = 0; x <= width; x += 8) {
          var y = baseY + Math.sin(x / w.len * Math.PI * 2 + w.phase + t * w.speed) * w.amp;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = w.color;
        ctx.fill();
      });

      ctx.fillStyle = "rgba(200,240,255,0.55)";
      bubbles.forEach(function (b) {
        b.y -= b.speed;
        b.x += Math.sin(t * 0.02 + b.phase) * b.drift;
        if (b.y < -10) {
          b.y = height + 10;
          b.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      });

      if (elapsed >= EXPLOSION_START) {
        if (!explosion) explosion = createExplosion(width / 2, height / 2);
        drawExplosion(ctx, explosion, elapsed - EXPLOSION_START, EXPLOSION_MS, width, height);
      }

      raf = requestAnimationFrame(frame);
    }
    frame();

    var timer = window.setTimeout(function () { finish(false); }, AUTO_FINISH_MS);

    skipBtn.addEventListener("click", function () { finish(false); });

    function finish(immediate) {
      window.clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);

      if (immediate) {
        introEl.remove();
        revealApp();
        return;
      }
      introEl.classList.add("intro--leaving");
      introEl.addEventListener("transitionend", function () { introEl.remove(); }, { once: true });
      revealApp();
    }
  }

  function revealApp() {
    var appEl = document.getElementById("app");
    appEl.hidden = false;
    requestAnimationFrame(function () { appEl.classList.add("app--visible"); });
  }

  /* ===== Service worker ===== */

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("service-worker.js").catch(function () {});
      });
    }
  }

  /* ===== PWA install ===== */

  function initInstallPrompt() {
    var btn = document.getElementById("install-pwa");
    if (!btn) return;

    var isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (isStandalone) return;

    var isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
    var deferredPrompt = null;

    if (isIOS) btn.hidden = false;

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      btn.hidden = false;
    });

    window.addEventListener("appinstalled", function () {
      btn.hidden = true;
      deferredPrompt = null;
    });

    btn.addEventListener("click", function () {
      if (deferredPrompt) {
        var prompted = deferredPrompt;
        deferredPrompt = null;
        prompted.prompt();
        prompted.userChoice.finally(function () { btn.hidden = true; });
        return;
      }
      if (isIOS) {
        document.getElementById("install-hint-modal").hidden = false;
      }
    });

    document.getElementById("install-hint-close").addEventListener("click", function () {
      document.getElementById("install-hint-modal").hidden = true;
    });
    document.getElementById("install-hint-modal").addEventListener("click", function (e) {
      if (e.target.id === "install-hint-modal") e.currentTarget.hidden = true;
    });
  }

  /* ===== Init ===== */

  document.addEventListener("DOMContentLoaded", function () {
    render();

    document.getElementById("seat-modal-close").addEventListener("click", closeSeatModal);
    document.getElementById("modal-add-person").addEventListener("click", addPerson);
    document.getElementById("seat-modal").addEventListener("click", function (e) {
      if (e.target.id === "seat-modal") closeSeatModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && activeModalSeatId) closeSeatModal();
    });

    initIntro();
    registerServiceWorker();
    initInstallPrompt();
  });
})();
